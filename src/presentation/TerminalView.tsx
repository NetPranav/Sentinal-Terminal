import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { invoke } from '@tauri-apps/api/core';
import { SessionManager } from '../domain/SessionManager';
import { Planner } from '../domain/planner/Planner';
import { CapabilityManager } from '../domain/Capability';
import { ShellCapability } from '../domain/capabilities/ShellCapability';
import { FilesystemCapability } from '../domain/capabilities/FilesystemCapability';
import { ProcessCapability } from '../domain/capabilities/ProcessCapability';
import { NetworkCapability } from '../domain/capabilities/NetworkCapability';
import { SystemCapability } from '../domain/capabilities/SystemCapability';
import { ClipboardCapability } from '../domain/capabilities/ClipboardCapability';
import { WorkflowEngine } from '../domain/workflow/WorkflowEngine';
import { ExecutionEngine } from '../domain/security/ExecutionEngine';
import { PermissionManager } from '../domain/security/PermissionManager';
import { SecurityEngine } from '../domain/security/SecurityEngine';
import { PolicyEngine } from '../domain/security/PolicyEngine';
import { AuditLogger } from '../domain/security/AuditLogger';
import { ShellCommandGuard } from '../domain/security/ShellCommandGuard';
import { AgentRuntime } from '../domain/agent/AgentRuntime';
import { ToolLoader } from '../tools/loader/ToolLoader';
import { AppAliasRegistry } from '../domain/capabilities/AppAliasRegistry';

import { AutocompleteEngine } from '../domain/autocomplete/AutocompleteEngine';
import { HistoryProvider } from '../domain/autocomplete/HistoryProvider';
import { GhostTextRenderer } from '../ui/components/GhostText';
import { ThemeManager } from '../ui/theme/ThemeManager';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
  isActive: boolean;
  currentPath?: string;
  onPathChange?: (newPath: string) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ sessionId: initialSessionId, onSessionCreated, isActive, currentPath, onPathChange }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);

  const [securityModalPlan, setSecurityModalPlan] = useState<{
    plan: any;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const pendingShellExecRef = useRef<{ sessionId: string; command: string } | null>(null);

  const handleAuthorize = async () => {
    if (!authPassword.trim()) {
      setAuthError('Password authentication is strictly required.');
      return;
    }
    setIsVerifying(true);
    setAuthError('');

    let isValid = false;
    let errorMessage = '';

    try {
      if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) {
        // Fallback for non-Tauri browser development environments
        if (authPassword !== 'admin' && authPassword !== 'password' && authPassword !== 'sentinel') {
          isValid = false;
          errorMessage = 'Authentication failed: Incorrect system password. Please enter your valid macOS login password.';
        } else {
          isValid = true;
        }
      } else {
        const escaped = authPassword.replace(/'/g, "'\\''");
        // Securely verify system password against macOS Directory Service login credentials
        const res = await invoke<{ code?: number; stderr?: string; stdout?: string }>('execute_command', {
          command: 'sh',
          args: ['-c', `dscl . -authonly "$(whoami)" '${escaped}' 2>&1 || (echo '${escaped}' | sudo -S -k -v 2>&1)`]
        });
        if (res && res.code === 0) {
          isValid = true;
        } else {
          isValid = false;
          errorMessage = 'Authentication failed: Incorrect system password. Please enter your valid macOS login password.';
        }
      }
    } catch (err: any) {
      isValid = false;
      errorMessage = 'Authentication failed: Incorrect system password. Please enter your valid macOS login password.';
    }

    setIsVerifying(false);
    if (isValid && securityModalPlan) {
      securityModalPlan.resolve(true);
      setSecurityModalPlan(null);
      setAuthPassword('');
    } else {
      setAuthError(errorMessage || 'Authentication failed: Invalid system password.');
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const themeManager = ThemeManager.getInstance();
    const currentTheme = themeManager.getTheme();

    const term = new Terminal({
      cursorBlink: true,
      allowTransparency: true,
      fontFamily: currentTheme.ui.fontFamily || 'Menlo, Monaco, "Courier New", monospace',
      fontSize: currentTheme.ui.fontSize || 14,
      theme: {
        background: 'rgba(0, 0, 0, 0)', // Completely transparent to reveal glassmorphism backdrop
        foreground: currentTheme.colors.foreground,
        cursor: currentTheme.colors.cursor,
        cursorAccent: currentTheme.colors.cursorAccent,
        selectionBackground: currentTheme.colors.selection,
      }
    });

    const unsubscribeTheme = themeManager.subscribe((t) => {
      term.options.fontFamily = t.ui.fontFamily;
      term.options.fontSize = t.ui.fontSize;
      term.options.theme = {
        ...term.options.theme,
        background: 'rgba(0, 0, 0, 0)',
        foreground: t.colors.foreground,
        cursor: t.colors.cursor,
        cursorAccent: t.colors.cursorAccent,
        selectionBackground: t.colors.selection,
      };
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon could not be loaded");
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    fitAddon.fit();

    let currentSessionId = initialSessionId;
    const sessionManager = SessionManager.getInstance();

    // Helper to write output locally while recording to SessionManager buffer for pane switching persistence
    const writeTerm = (text: string) => {
      term.write(text);
      if (currentSessionId) {
        sessionManager.recordOutput(currentSessionId, text);
      }
    };
    
    // We must define the callback here so we can remove it later
    let outputCallback: ((data: Uint8Array) => void) | null = null;

    const initSession = async () => {
      try {
        if (!currentSessionId) {
          currentSessionId = await sessionManager.createSession(term.rows, term.cols);
          setSessionId(currentSessionId);
          onSessionCreated?.(currentSessionId);
        } else {
          await sessionManager.resize(currentSessionId, term.rows, term.cols);
        }

        outputCallback = (data: Uint8Array) => {
          term.write(data);
        };

        sessionManager.onOutput(currentSessionId, outputCallback);

        // Initialize AI Operating Knowledge Base (Tool Registry) & Planner
        const toolLoader = new ToolLoader();
        toolLoader.loadAll(); // Loads JSON metadata, workflows, knowledge & builds indexes
        
        const capabilityManager = CapabilityManager.getInstance();
        
        // Register Core Execution Capabilities (consumed by Workflow/Execution Engine)
        capabilityManager.register(new ShellCapability());
        capabilityManager.register(new FilesystemCapability());
        capabilityManager.register(new ProcessCapability());
        capabilityManager.register(new NetworkCapability());
        capabilityManager.register(new SystemCapability());
        capabilityManager.register(new ClipboardCapability());

        const planner = new Planner(toolLoader.getState());

        // Initialize Autocomplete
        const autocompleteEngine = new AutocompleteEngine();
        const historyProvider = new HistoryProvider();
        autocompleteEngine.registerProvider(historyProvider);
        
        const ghostText = new GhostTextRenderer(term);
        ghostText.attach(terminalRef.current!);

        term.onData(async (data) => {
          if (!currentSessionId) return;

          // Handle Tab completion or Right Arrow completion
          if (data === '\t' || data === '\x1b[C') {
             const remaining = ghostText.getRemaining();
             if (remaining) {
               await sessionManager.write(currentSessionId, remaining);
               ghostText.clear();
               return; // Intercept key
             }
          }

          // Intercept Enter key for classification and history
          if (data.includes('\r') || data === '\n') {
            ghostText.clear();
            const buffer = term.buffer.active;
            const lineIndex = buffer.baseY + buffer.cursorY;
            const line = buffer.getLine(lineIndex);
            
            if (line) {
              let currentLineIndex = lineIndex;
              let fullText = '';
              
              // Read backwards up to 3 lines to handle terminal wrapping and empty cursor lines
              for (let i = 0; i < 3 && currentLineIndex >= 0; i++) {
                const l = buffer.getLine(currentLineIndex);
                if (!l) break;
                
                fullText = l.translateToString(false).replace(/\s+$/, '') + fullText;
                
                if (fullText.match(/.*[$%#]\s*/)) {
                  break;
                }
                currentLineIndex--;
              }
              
              // Simple heuristic to strip prompt: look for the last common prompt character
              const promptMatch = fullText.match(/.*[$%#]\s*/);
              const commandText = promptMatch ? fullText.substring(promptMatch[0].length) : fullText;

              if (commandText.trim()) {
                 historyProvider.addHistory(commandText.trim(), currentPath || '~');
              }

              console.log("[TerminalView] Full text intercepted:", fullText);
              console.log("[TerminalView] Extracted command:", commandText);
              
              const cleanCmd = commandText.trim();

              const notifyNavigation = (target: string) => {
                if (!onPathChange) return;
                const curr = (currentPath || '~').replace(/\/+/g, '/').trim();
                let next = curr;
                if (target === '~' || target === '/' || target === '..' || target === 'home' || target === '') {
                  if (target === '~' || target === 'home' || target === '') next = '~';
                  else if (target === '/') next = '/';
                  else if (target === '..') {
                    if (curr !== '~' && curr !== '/') {
                      const parts = curr.split('/').filter(Boolean);
                      parts.pop();
                      next = parts.join('/') || '~';
                    } else {
                      next = '~';
                    }
                  }
                } else if (target.startsWith('~/') || target.startsWith('/')) {
                  next = target;
                } else {
                  next = `${curr === '/' ? '' : curr}/${target}`.replace(/\/+/g, '/');
                }
                onPathChange(next);
              };

              if (cleanCmd.startsWith('cd ') || cleanCmd === 'cd') {
                const target = cleanCmd.replace(/^cd\s*/i, '').replace(/["']/g, '').trim() || '~';
                notifyNavigation(target);
              }

              // Intercept application mapping slash commands: /app, /apps, /alias, /aliases
              if (cleanCmd.startsWith('/app') || cleanCmd.startsWith('/alias')) {
                await sessionManager.write(currentSessionId!, '\x03');
                const match = cleanCmd.match(/^\/(?:apps?|aliases?)(?:\s+([^\s"']+)\s+["']?(.+?)["']?)?\s*$/i);
                if (match && match[1] && match[2]) {
                  AppAliasRegistry.getInstance().setAlias(match[1], match[2]);
                  writeTerm(`\r\n\x1b[1;32m[App Registry] Successfully registered application mapping:\x1b[0m\r\n`);
                  writeTerm(`  • Alias: \x1b[1;36m"${match[1]}"\x1b[0m ──► Application: \x1b[1;33m"${match[2]}"\x1b[0m\r\n`);
                  writeTerm(`\x1b[37m[App Registry] Saved to persistent storage (~/.sentinel/app_aliases.json).\x1b[0m\r\n\r\n`);
                } else {
                  writeTerm(`\r\n\x1b[1;35m[App Registry] Currently Registered Application Mappings:\x1b[0m\r\n`);
                  const aliases = AppAliasRegistry.getInstance().getAll();
                  Object.entries(aliases).forEach(([alias, actual]) => {
                    writeTerm(`  • \x1b[36m${alias}\x1b[0m ──► \x1b[33m${actual}\x1b[0m\r\n`);
                  });
                  writeTerm(`\r\n\x1b[37mUsage to register/override an alias:\x1b[0m \x1b[1;32m/app <alias> "<actual_application_name>"\x1b[0m\r\n`);
                  writeTerm(`Example: \x1b[36m/app chrome "Google Chrome"\x1b[0m\r\n\r\n`);
                }
                return;
              }

              // Only trigger AI execution when written after ">" (e.g., ">find me the AAAA folder" or ">go to downloads")
              if (cleanCmd.startsWith('>')) {
                const aiGoal = cleanCmd.substring(1).trim();
                if (!aiGoal) {
                  return; // Empty AI instruction
                }

                const lowerCmd = aiGoal.toLowerCase().replace(/[^a-z0-9\/~\-._ ]/g, '').trim();

                // 1. Check for AI Natural Language navigation shortcuts
                const backCmds = ['go back', 'navigate back', 'move back', 'step back', 'go backward', 'go up', 'navigate up', 'move up', 'up a folder', 'up a dir', 'up a directory', 'go out', 'parent folder', 'parent directory', 'exit folder', 'exit directory', 'back', 'take me back', 'bring me back'];
                const homeCmds = ['go home', 'navigate home', 'move home', 'take me home', 'home folder', 'home directory', 'return home', 'go to home', 'navigate to home', 'switch to home', 'cd home', 'bring me home'];
                const strippedCmd = aiGoal.replace(/^(?:(?:hey|hi|hello|please|can you|could you|would you|kindly|just|now|alright|there|then|so|friend|dude|mate|i want you to|i wnat you to|i want to|i need you to|help me to|we need to|you should|let's|lets)(?:\s+|,)*)+/i, '').trim();
                const lowerStripped = strippedCmd.toLowerCase();

                if (backCmds.includes(lowerCmd) || backCmds.includes(lowerStripped)) {
                  notifyNavigation('..');
                  await sessionManager.write(currentSessionId!, '\x03');
                  writeTerm('\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32mcd ..\x1b[0m\r\n');
                  setTimeout(() => sessionManager.write(currentSessionId!, 'cd ..\r'), 80);
                  return;
                } else if (homeCmds.includes(lowerCmd) || homeCmds.includes(lowerStripped)) {
                  notifyNavigation('~');
                  await sessionManager.write(currentSessionId!, '\x03');
                  writeTerm('\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32mcd ~\x1b[0m\r\n');
                  setTimeout(() => sessionManager.write(currentSessionId!, 'cd ~\r'), 80);
                  return;
                } else {
                  const navMatch = aiGoal.match(/(?:go to|navigate to|move to|switch to|jump to|enter|cd into|goto|take me to|bring me to|head to|head over to|change directory to|change folder to|switch folder to|switch dir to)\s+(.+)$/i);
                  if (navMatch && navMatch[1]) {
                    let target = navMatch[1].replace(/\s+(?:folder|fodler|directory|dir)$/i, '').replace(/\/+$/, '').trim();
                    const knownDirs: Record<string, string> = {
                      'downloads': '~/Downloads', 'donwloads': '~/Downloads', 'downlaods': '~/Downloads', 'dwonloads': '~/Downloads', 'dowloads': '~/Downloads',
                      'desktop': '~/Desktop', 'dekstop': '~/Desktop', 'desktp': '~/Desktop',
                      'documents': '~/Documents', 'documets': '~/Documents', 'documens': '~/Documents',
                      'pictures': '~/Pictures', 'pictues': '~/Pictures', 'photos': '~/Pictures',
                      'music': '~/Music', 'audio': '~/Music', 'songs': '~/Music',
                      'movies': '~/Movies', 'videos': '~/Movies',
                      'applications': '~/Applications', 'apps': '~/Applications',
                      'home': '~', 'root': '/'
                    };
                    const lowerTarget = target.toLowerCase();
                    if (knownDirs[lowerTarget]) {
                      target = knownDirs[lowerTarget];
                    }
                    notifyNavigation(target.replace(/["']/g, ''));
                    const cdCmd = target.includes(' ') && !target.startsWith('"') && !target.startsWith("'") ? `cd "${target}"` : `cd ${target}`;
                    await sessionManager.write(currentSessionId!, '\x03');
                    writeTerm(`\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32m${cdCmd}\x1b[0m\r\n`);
                    setTimeout(() => sessionManager.write(currentSessionId!, `${cdCmd}\r`), 80);
                    return;
                  }
                }

                // 2. If not a simple navigation shortcut, route to AI Planner
                console.log("[TerminalView] Triggering AI Planner for goal:", aiGoal);
                await sessionManager.write(currentSessionId, '\x03');
                writeTerm(`\r\n\x1b[35m[AI Planner] Analyzing instruction: "${aiGoal}"...\x1b[0m\r\n`);
                
                // Trigger planner asynchronously
                planner.plan({
                  goal: aiGoal,
                  context: { os: 'mac', shell: 'zsh', cwd: currentPath || '~' }
                }).then(response => {
                  if (response.success && response.workflow) {
                    writeTerm(`\r\n\x1b[32m[AI Planner] Created workflow: ${response.workflow.name}\x1b[0m\r\n`);
                    writeTerm(`\x1b[36mSummary: ${response.summary}\x1b[0m\r\n`);
                    if (response.intentResult) {
                      writeTerm(`\x1b[35m[Local Intent AI] Active Model: ${response.intentResult.modelId} (${response.intentResult.providerId}) | Confidence: ${Math.round(response.intentResult.confidence * 100)}%\x1b[0m\r\n`);
                      if (response.intentResult.tasks && response.intentResult.tasks.length > 1) {
                        writeTerm(`\x1b[33m[Execution Plan] Sequential Tasks (${response.intentResult.tasks.length}):\x1b[0m\r\n`);
                        response.intentResult.tasks.forEach((t, idx) => {
                          writeTerm(`   ${idx + 1}. Tool: \x1b[1;36m${t.tool}\x1b[0m | Entities: ${JSON.stringify(t.entities)}\r\n`);
                        });
                      }
                    }
                    
                    // Instantiate execution dependencies
                    const permissionManager = PermissionManager.getInstance();
                    const securityEngine = new SecurityEngine();
                    const policyEngine = new PolicyEngine();
                    const auditLogger = AuditLogger.getInstance();
                    const executionEngine = new ExecutionEngine(
                      capabilityManager, permissionManager, securityEngine, policyEngine, auditLogger
                    );
                    const workflowEngine = new WorkflowEngine();
                    
                    const runtime = new AgentRuntime(workflowEngine, executionEngine, planner, response.workflow);
                    let targetCdPath: string | null = null;
                    
                    runtime.setAuthorizationHandler((plan: any) => {
                      return new Promise<boolean>((resolve) => {
                        setAuthPassword('');
                        setAuthError('');
                        setSecurityModalPlan({ plan, resolve });
                      });
                    });

                    runtime.on((event, payload) => {
                      if (event === 'ApprovalRequested' && payload?.plan) {
                        const p = payload.plan;
                        writeTerm(`\r\n\x1b[1;31m[Security Engine: ${p.riskLevel || 'CRITICAL'} RISK ACTION DETECTED]\x1b[0m\r\n`);
                        writeTerm(`  • Operation: \x1b[1;36m${p.capabilityId}\x1b[0m\r\n`);
                        writeTerm(`  • Target: \x1b[1;33m${p.parameters?.path || p.parameters?.source || p.parameters?.directory || p.parameters?.command || JSON.stringify(p.parameters)}\x1b[0m\r\n`);
                        writeTerm(`  • Explanation: \x1b[37m${p.explanation || 'Destructive filesystem operation requires authorization'}\x1b[0m\r\n`);
                        writeTerm(`\x1b[1;33m[Security Authentication Hold]\x1b[0m Paused workflow execution. Awaiting mandatory user consent & password authentication in popup modal...\r\n`);
                        return;
                      } else if (event === 'ApprovalGranted') {
                        writeTerm(`\x1b[1;32m[Security Authentication Verified]\x1b[0m User consent granted & password credentials verified. Continuing execution.\r\n`);
                        return;
                      }

                      // Format log nicely
                      let msg = payload?.log || event;
                      if (event === 'VerificationFailed' && payload?.error) {
                        msg = `VerificationFailed: ${payload.error.message || payload.error.code || 'Unknown error'}`;
                      } else if (event === 'StepCompleted' && payload?.step) {
                        msg = `StepCompleted: ${payload.step.name}`;
                        if (payload.data?.path && typeof payload.data.path === 'string' && (payload.step.action?.capability === 'filesystem.cd' || payload.step.action?.capability === 'shell.cd' || String(payload.data?.stdout || '').includes('Changed directory to:'))) {
                          targetCdPath = payload.data.path;
                        }
                        if (payload.step.action?.capability === 'shell.execute' && (payload.step.action?.parameters?.command === 'clear' || payload.step.parameters?.command === 'clear')) {
                          term.clear();
                          writeTerm('\x1b[2J\x1b[H');
                          return;
                        } else if (payload.data?.stdout) {
                          writeTerm(`\r\n\x1b[32m[Command Output]\x1b[0m\r\n${String(payload.data.stdout).replace(/\n/g, '\r\n')}\r\n`);
                        } else if (payload.data?.stderr) {
                          writeTerm(`\r\n\x1b[33m[Command Output (Stderr)]\x1b[0m\r\n${String(payload.data.stderr).replace(/\n/g, '\r\n')}\r\n`);
                        } else if (payload.data && typeof payload.data === 'object' && Object.keys(payload.data).length > 0) {
                          const formatted = Object.entries(payload.data)
                            .filter(([k]) => k !== 'commandExecuted' && k !== 'dryRun')
                            .map(([k, v]) => {
                              if (Array.isArray(v)) {
                                const hasObjects = v.some(item => typeof item === 'object' && item !== null);
                                if (hasObjects) {
                                  const listStr = v.map((item, idx) => {
                                    if (typeof item === 'object' && item !== null) {
                                      const details = Object.entries(item)
                                        .map(([propK, propV]) => `\x1b[36m${propK}:\x1b[0m ${propV}`)
                                        .join(' | ');
                                      return `\r\n    \x1b[33m${idx + 1}.\x1b[0m ${details}`;
                                    }
                                    return `\r\n    ${idx + 1}. ${item}`;
                                  }).join('');
                                  return `  • \x1b[1;37m${k}\x1b[0m:${listStr}`;
                                }
                                return `  • ${k}: ${v.join(', ')}`;
                              }
                              return `  • ${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`;
                            })
                            .join('\r\n');
                          if (formatted.trim()) {
                            writeTerm(`\r\n\x1b[32m[Capability Output]\x1b[0m\r\n${formatted}\r\n`);
                          }
                        }
                      }
                      writeTerm(`\x1b[34m[AgentRuntime] ${msg}\x1b[0m\r\n`);
                    });

                    writeTerm(`\x1b[33mStarting Agent Runtime...\x1b[0m\r\n`);
                    runtime.start().then(summary => {
                      const isClearCmd = aiGoal.toLowerCase() === 'clear' || aiGoal.toLowerCase().includes('clear terminal') || aiGoal.toLowerCase().includes('clear screen') || aiGoal.toLowerCase().includes('clean screen') || aiGoal.toLowerCase().includes('clean terminal');
                      if (isClearCmd && summary.finalResult === 'Success') {
                        term.clear();
                        writeTerm('\x1b[2J\x1b[H');
                        sessionManager.write(currentSessionId!, '\r');
                        return;
                      }
                      writeTerm(`\r\n\x1b[35m[Execution Summary]\x1b[0m\r\n`);
                      writeTerm(`Goal: ${summary.goal}\r\n`);
                      writeTerm(`Result: ${summary.finalResult}\r\n`);
                      writeTerm(`Time: ${summary.executionTimeMs.toFixed(2)}ms\r\n`);
                      writeTerm(`Completed: ${summary.completedSteps.length}\r\n`);
                      writeTerm(`Failed: ${summary.failedSteps.length}\r\n`);
                      writeTerm(`Retries: ${Object.keys(summary.retries).length}\r\n`);
                      writeTerm(`Repairs: ${summary.repairCount}\r\n`);
                      writeTerm('\r\n');
                      if (targetCdPath) {
                        notifyNavigation(targetCdPath);
                        const cdCmd = targetCdPath.includes(' ') && !targetCdPath.startsWith('"') && !targetCdPath.startsWith("'") ? `cd "${targetCdPath}"` : `cd ${targetCdPath}`;
                        setTimeout(() => sessionManager.write(currentSessionId!, `${cdCmd}\r`), 50);
                      } else {
                        sessionManager.write(currentSessionId!, '\r');
                      }
                    });
                  } else {
                    writeTerm(`\x1b[31m[AI Planner Failed] ${response.error?.message || 'Unknown error'}\x1b[0m\r\n\r\n`);
                    sessionManager.write(currentSessionId!, '\r');
                  }
                });
                
                return; // Do NOT send the \r to the shell
              }

              // Shell command security intercept — gate dangerous input before PTY execution
              const shellGuard = ShellCommandGuard.getInstance();
              const guardResult = shellGuard.evaluate(cleanCmd);

              if (guardResult.action === 'deny') {
                await sessionManager.write(currentSessionId, '\x03');
                writeTerm(`\r\n\x1b[1;31m[Security Engine: BLOCKED]\x1b[0m ${guardResult.blockReason || guardResult.risk.explanation}\r\n`);
                return;
              }

              if (guardResult.action === 'require_approval' && guardResult.previewPlan) {
                pendingShellExecRef.current = { sessionId: currentSessionId, command: cleanCmd };
                writeTerm(`\r\n\x1b[1;31m[Security Engine: ${guardResult.risk.level} RISK SHELL COMMAND]\x1b[0m\r\n`);
                writeTerm(`  • Command: \x1b[1;33m${cleanCmd}\x1b[0m\r\n`);
                writeTerm(`  • ${guardResult.risk.explanation}\r\n`);
                writeTerm(`\x1b[1;33m[Security Hold]\x1b[0m Awaiting authorization before shell execution...\r\n`);
                setAuthPassword('');
                setAuthError('');
                setSecurityModalPlan({
                  plan: guardResult.previewPlan,
                  resolve: (approved: boolean) => {
                    const pending = pendingShellExecRef.current;
                    pendingShellExecRef.current = null;
                    if (!pending) return;
                    if (approved) {
                      writeTerm(`\x1b[1;32m[Security Verified]\x1b[0m Executing authorized shell command.\r\n`);
                      sessionManager.write(pending.sessionId, '\r');
                    } else {
                      sessionManager.write(pending.sessionId, '\x03');
                      writeTerm(`\r\n\x1b[1;31m[Security Denied]\x1b[0m Shell command halted by user.\r\n`);
                    }
                  }
                });
                return;
              }
            }
          }

          sessionManager.write(currentSessionId, data);

          // Update ghost text asynchronously after terminal buffer updates
          if (data !== '\r' && data !== '\x03') {
            setTimeout(async () => {
              const buffer = term.buffer.active;
              const lineIndex = buffer.baseY + buffer.cursorY;
              const line = buffer.getLine(lineIndex);
              if (line) {
                const fullText = line.translateToString(true);
                const promptMatch = fullText.match(/.*[$%#]\s*/);
                const commandText = promptMatch ? fullText.substring(promptMatch[0].length).trimStart() : fullText.trimStart();
                
                if (commandText.length > 0) {
                  const suggestions = await autocompleteEngine.getSuggestions({ 
                    currentInput: commandText, 
                    cwd: currentPath || '~',
                    cursorPosition: commandText.length,
                    os: 'macos'
                  });
                  if (suggestions.length > 0) {
                     ghostText.render(suggestions[0].value, commandText);
                  } else {
                     ghostText.clear();
                  }
                } else {
                  ghostText.clear();
                }
              }
            }, 20);
          }
        });
      } catch (error: any) {
        console.error("Failed to initialize terminal session:", error);
        term.write('\x1b[31m\r\n[Sentinel Error] Failed to connect to terminal backend.\x1b[0m\r\n');
        term.write(`\x1b[31mError Details: ${error?.message || error}\x1b[0m\r\n`);
        if (error?.stack) {
          term.write(`\x1b[31m${error.stack.replace(/\n/g, '\r\n')}\x1b[0m\r\n`);
        }
        term.write('\x1b[33mAre you running this in a web browser instead of the Tauri app?\x1b[0m\r\n');
        term.write('\x1b[33mPlease use `npm run tauri dev` to launch the native desktop application.\x1b[0m\r\n');
      }
    };

    initSession();

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && currentSessionId) {
        try {
          fitAddonRef.current.fit();
          if (xtermRef.current.rows > 0 && xtermRef.current.cols > 0) {
            sessionManager.resize(currentSessionId, xtermRef.current.rows, xtermRef.current.cols);
          }
        } catch (e) {
          // Ignore resize calculations when dimensions are transitioning or 0
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Observe element dimensions so split panes dynamically refit immediately upon split or layout changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (currentSessionId && outputCallback) {
        sessionManager.offOutput(currentSessionId, outputCallback);
      }
      unsubscribeTheme();
      term.dispose();
    };
  }, []); // Run once on mount

  useEffect(() => {
    // When this tab becomes active, we should focus the terminal and refit
    if (isActive && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
        if (sessionId) {
          SessionManager.getInstance().resize(sessionId, xtermRef.current!.rows, xtermRef.current!.cols);
        }
      }, 50);
    }
  }, [isActive, sessionId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', display: isActive ? 'block' : 'none' }}>
      <div 
        ref={terminalRef} 
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }} 
      />

      {/* Security & Deletion Authorization Overlay Modal */}
      {securityModalPlan && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            background: 'rgba(22, 24, 32, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 4px 16px rgba(0, 0, 0, 0.5)',
            padding: '26px',
            color: '#fff',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                🔒
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.2px' }}>
                  System Authorization Required
                </h3>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.55)', display: 'block', marginTop: '2px' }}>
                  Protected operation requested • {securityModalPlan.plan.riskLevel || 'ADMIN'} Profile
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', lineHeight: '1.55', color: 'rgba(255, 255, 255, 0.75)', margin: '0 0 18px 0' }}>
              To ensure system integrity and prevent unauthorized modifications, please verify your macOS user login password to execute this capability.
            </p>

            <div style={{
              backgroundColor: 'rgba(10, 11, 15, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Action:</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{securityModalPlan.plan.capabilityId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)', flexShrink: 0 }}>Target:</span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-all', textAlign: 'right', fontWeight: 500 }}>
                  {String(securityModalPlan.plan.parameters?.path || securityModalPlan.plan.parameters?.source || securityModalPlan.plan.parameters?.command || JSON.stringify(securityModalPlan.plan.parameters))}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '8px', fontWeight: 500 }}>
                macOS User Login Password:
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                placeholder="Enter system credentials..."
                autoFocus
                disabled={isVerifying}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isVerifying) {
                    handleAuthorize();
                  } else if (e.key === 'Escape' && !isVerifying) {
                    securityModalPlan.resolve(false);
                    setSecurityModalPlan(null);
                    setAuthPassword('');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: authError ? '1px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                  backgroundColor: 'rgba(8, 9, 13, 0.75)',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s ease'
                }}
              />
              {authError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span> {authError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                disabled={isVerifying}
                onClick={() => {
                  securityModalPlan.resolve(false);
                  setSecurityModalPlan(null);
                  setAuthPassword('');
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: '#cbd5e1',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'background-color 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                disabled={isVerifying}
                onClick={handleAuthorize}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isVerifying ? 'rgba(255, 255, 255, 0.2)' : '#f59e0b',
                  color: isVerifying ? '#ffffff' : '#000000',
                  fontSize: '13px',
                  cursor: isVerifying ? 'wait' : 'pointer',
                  fontWeight: 600,
                  boxShadow: isVerifying ? 'none' : '0 2px 10px rgba(245, 158, 11, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isVerifying ? 'Authenticating...' : 'Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
