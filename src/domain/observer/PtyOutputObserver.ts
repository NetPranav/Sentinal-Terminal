/**
 * Sentinel Terminal — Passive PTY Output Stream Observer
 *
 * Monitors real-time terminal stdout/stderr stream from standard shell sessions.
 * When non-AI commands crash or fail with diagnostic signatures (e.g. EADDRINUSE,
 * git index lock, missing modules), it correlates the failure and offers 1-click
 * inline remediation without requiring user prompt copy-pasting.
 */

import { DiagnosticResult, ErrorDiagnosticsEngine } from '../../ai/agent/ErrorDiagnosticsEngine';
import { SentinelSerlCoordinator } from '../learning/SentinelSerlCoordinator';

export interface RemediationPrompt {
  id: string;
  cause: string;
  actionTitle: string;
  tool: string;
  params: Record<string, any>;
  rawError: string;
  timestamp: number;
  fixedCommand?: string;
}

export class PtyOutputObserver {
  private static instance: PtyOutputObserver;
  private recentOutputBuffer: string[] = [];
  private activeRemediation: RemediationPrompt | null = null;
  private listeners: ((remediation: RemediationPrompt | null) => void)[] = [];

  public static getInstance(): PtyOutputObserver {
    if (!PtyOutputObserver.instance) {
      PtyOutputObserver.instance = new PtyOutputObserver();
    }
    return PtyOutputObserver.instance;
  }

  /**
   * Ingest streaming terminal output chunks
   */
  public ingest(chunk: string, cwd?: string, command?: string): RemediationPrompt | null {
    if (!chunk) return null;

    // Filter out common raw ANSI escape codes to inspect clean text
    const cleanChunk = chunk.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

    // Keep last 40 lines of scrollback
    const lines = cleanChunk.split(/\r?\n/).filter(Boolean);
    this.recentOutputBuffer.push(...lines);
    if (this.recentOutputBuffer.length > 40) {
      this.recentOutputBuffer = this.recentOutputBuffer.slice(this.recentOutputBuffer.length - 40);
    }

    // Attempt to extract latest shell command from scrollback if not passed
    let detectedCommand = command;
    if (!detectedCommand) {
      for (let i = this.recentOutputBuffer.length - 1; i >= 0; i--) {
        const line = this.recentOutputBuffer[i].trim();
        const promptMatch = line.match(/(?:[$%#>]\s+|\$\s*)([a-zA-Z0-9_\.\-\/]+.*)/);
        if (promptMatch) {
          detectedCommand = promptMatch[1].trim();
          break;
        }
      }
    }

    const fullRecent = this.recentOutputBuffer.join('\n');
    const diag = ErrorDiagnosticsEngine.diagnose(fullRecent, undefined, undefined, cwd, detectedCommand);

    if (diag.category === 'SOFTWARE_RECOVERABLE' && diag.remediation) {
      const fixedCmd = diag.remediation.params?.command;
      const remediation: RemediationPrompt = {
        id: 'rem_' + Date.now(),
        cause: diag.cause,
        actionTitle: diag.remediation.title,
        tool: diag.remediation.tool,
        params: diag.remediation.params,
        rawError: diag.cause,
        timestamp: Date.now(),
        fixedCommand: fixedCmd
      };
      this.activeRemediation = remediation;
      this.notify(remediation);
      return remediation;
    } else if (detectedCommand && (cleanChunk.includes('error:') || cleanChunk.includes('command not found') || cleanChunk.includes('fatal:') || cleanChunk.includes('failed'))) {
      try {
        SentinelSerlCoordinator.getInstance().onCommandExecutionFailure(
          `Shell command: ${detectedCommand}`,
          detectedCommand,
          1,
          cleanChunk,
          { cwd, os: 'macos' }
        );
      } catch {
        // Non-blocking background deficit logging
      }
    }

    return null;
  }

  public getActiveRemediation(): RemediationPrompt | null {
    // Expire remediation after 2 minutes
    if (this.activeRemediation && Date.now() - this.activeRemediation.timestamp > 120000) {
      this.activeRemediation = null;
    }
    return this.activeRemediation;
  }

  public clearRemediation(): void {
    this.activeRemediation = null;
    this.recentOutputBuffer = [];
    this.notify(null);
  }

  public onRemediation(listener: (remediation: RemediationPrompt | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(rem: RemediationPrompt | null): void {
    this.listeners.forEach(l => {
      try {
        l(rem);
      } catch { /* ignore listener error */ }
    });
  }
}
