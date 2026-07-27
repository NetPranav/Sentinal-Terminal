import { ExecutionPreviewPlan } from './ExecutionEngine';
import { ISecurityEngine, RiskAnalysisResult, SecurityEngine } from './SecurityEngine';

export type ShellGuardAction = 'allow' | 'require_approval' | 'deny';

export interface ShellGuardResult {
  action: ShellGuardAction;
  command: string;
  risk: RiskAnalysisResult;
  previewPlan?: ExecutionPreviewPlan;
  blockReason?: string;
}

/**
 * Intercepts direct shell input before it reaches the PTY.
 * Routes dangerous commands through the same risk analysis as AI workflows.
 */
export class ShellCommandGuard {
  private static instance: ShellCommandGuard;

  static getInstance(securityEngine?: ISecurityEngine): ShellCommandGuard {
    if (!ShellCommandGuard.instance) {
      ShellCommandGuard.instance = new ShellCommandGuard(securityEngine ?? new SecurityEngine());
    }
    return ShellCommandGuard.instance;
  }

  constructor(private readonly securityEngine: ISecurityEngine) {}

  evaluate(commandLine: string): ShellGuardResult {
    const command = commandLine.trim();
    if (!command) {
      return {
        action: 'allow',
        command,
        risk: { score: 0, level: 'SAFE', explanation: 'Empty command.' }
      };
    }

    const parts = command.split(/\s+/);
    const binary = parts[0];
    const args = parts.slice(1);
    let risk = this.securityEngine.analyzeCommand(binary, args);

    // Catch single-token destructive binaries missed by spaced patterns
    risk = this.enhanceRiskForEdgeCases(command, binary, risk);

    const pipeRisk = this.analyzePipedExecution(command);
    if (pipeRisk && pipeRisk.score > risk.score) {
      risk = pipeRisk;
    }

    const protectedPath = this.detectProtectedPathDeletion(command);
    if (protectedPath) {
      return {
        action: 'deny',
        command,
        risk: {
          score: 100,
          level: 'CRITICAL',
          explanation: `Hard block: destructive operation targeting protected path '${protectedPath}'.`,
          requiresPassword: true,
          requiresConsent: true
        },
        blockReason: `Cannot delete or modify protected system path: ${protectedPath}`
      };
    }

    if (this.shouldRequireApproval(risk)) {
      return {
        action: 'require_approval',
        command,
        risk,
        previewPlan: this.toPreviewPlan(command, risk)
      };
    }

    return { action: 'allow', command, risk };
  }

  private shouldRequireApproval(risk: RiskAnalysisResult): boolean {
    return (
      risk.level === 'CRITICAL' ||
      risk.level === 'ADMIN' ||
      risk.requiresConsent === true ||
      risk.requiresPassword === true
    );
  }

  private enhanceRiskForEdgeCases(
    command: string,
    binary: string,
    risk: RiskAnalysisResult
  ): RiskAnalysisResult {
    const lowerBinary = binary.toLowerCase();
    const lowerCmd = command.toLowerCase();

    const destructiveBinaries = ['rm', 'rmdir', 'unlink', 'shred', 'truncate'];
    if (destructiveBinaries.includes(lowerBinary)) {
      return {
        score: 95,
        level: 'CRITICAL',
        explanation: 'Filesystem deletion command detected. Explicit user consent required before execution.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    const adminBinaries = ['sudo', 'su', 'doas', 'chmod', 'chown', 'chgrp', 'kill', 'pkill', 'killall'];
    if (adminBinaries.includes(lowerBinary)) {
      return {
        score: 90,
        level: 'ADMIN',
        explanation: 'Administrative or process-control shell command detected. Explicit user consent required.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    if (/\b(mkfs|dd|diskutil\s+erase|format)\b/.test(lowerCmd)) {
      return {
        score: 100,
        level: 'CRITICAL',
        explanation: 'Disk formatting or destructive block-device command detected.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    return risk;
  }

  private analyzePipedExecution(command: string): RiskAnalysisResult | null {
    const lower = command.toLowerCase();
    if (/\|\s*(bash|sh|zsh|fish|dash|ksh|csh|tcsh)\b/.test(lower)) {
      return {
        score: 100,
        level: 'CRITICAL',
        explanation: 'Piping remote or untrusted content into a shell interpreter is blocked without explicit authorization.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    if (/\bcurl\b.*\|\s*(bash|sh)\b/.test(lower) || /\bwget\b.*\|\s*(bash|sh)\b/.test(lower)) {
      return {
        score: 100,
        level: 'CRITICAL',
        explanation: 'Remote script download piped to shell detected — high malware risk.',
        requiresPassword: true,
        requiresConsent: true
      };
    }

    return null;
  }

  private detectProtectedPathDeletion(command: string): string | null {
    const protectedPaths = ['/System', '/usr', '/bin', '/sbin', '/etc', '/var', '/Windows', '/Library'];
    const lower = command.toLowerCase();

    if (!/\b(rm|rmdir|unlink|shred|trash|mv)\b/.test(lower)) {
      return null;
    }

    const tokens = command.trim().split(/\s+/);
    const targets = tokens.filter((token) => !token.startsWith('-') && !/^(rm|rmdir|unlink|shred|trash|mv|sudo)$/i.test(token));

    for (const target of targets) {
      const normalized = target.replace(/^['"]|['"]$/g, '');
      if (normalized === '/' || normalized === '~' || normalized === '$HOME' || normalized === '${HOME}') {
        return normalized;
      }
      for (const protectedPath of protectedPaths) {
        if (normalized === protectedPath || normalized.startsWith(`${protectedPath}/`)) {
          return protectedPath;
        }
      }
    }

    return null;
  }

  private toPreviewPlan(command: string, risk: RiskAnalysisResult): ExecutionPreviewPlan {
    return {
      capabilityId: 'shell.direct',
      parameters: { command },
      riskLevel: risk.level,
      riskScore: risk.score,
      permissionsRequired: ['ShellExecution', 'user_consent'],
      explanation: risk.explanation,
      requiresPassword: risk.requiresPassword ?? true,
      requiresConsent: risk.requiresConsent ?? true
    };
  }
}
