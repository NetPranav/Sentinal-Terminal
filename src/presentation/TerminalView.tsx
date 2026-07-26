import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
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
import { AgentRuntime } from '../domain/agent/AgentRuntime';
import { ToolLoader } from '../tools/loader/ToolLoader';

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
             const suggestion = ghostText.getSuggestion();
             if (suggestion) {
                const buffer = term.buffer.active;
                const lineIndex = buffer.baseY + buffer.cursorY;
                const line = buffer.getLine(lineIndex);
                if (line) {
                  const fullText = line.translateToString(true);
                  const promptMatch = fullText.match(/.*[$%#>]\s*/);
                  const commandText = promptMatch ? fullText.substring(promptMatch[0].length) : fullText;
                  
                  if (suggestion.toLowerCase().startsWith(commandText.toLowerCase())) {
                    const remaining = suggestion.substring(commandText.length);
                    if (remaining) {
                       await sessionManager.write(currentSessionId, remaining);
                       ghostText.clear();
                       return; // Intercept key
                    }
                  }
                }
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
                
                if (fullText.match(/.*[$%#>]\s*/)) {
                  break;
                }
                currentLineIndex--;
              }
              
              // Simple heuristic to strip prompt: look for the last common prompt character
              const promptMatch = fullText.match(/.*[$%#>]\s*/);
              const commandText = promptMatch ? fullText.substring(promptMatch[0].length) : fullText;

              if (commandText.trim()) {
                 historyProvider.addHistory(commandText.trim(), 'unknown');
              }

              const isNaturalLanguage = (text: string) => {
                const trimmed = text.trim();
                if (!trimmed) return false;
                const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
                const strictShellCommands = [
                  'cd', 'pwd', 'clear', 'reset', 'exit', 'history', 'whoami',
                  'git', 'npm', 'npx', 'yarn', 'pnpm', 'node', 'deno', 'bun',
                  'python', 'python3', 'pip', 'pip3', 'cargo', 'rustc', 'vim',
                  'vi', 'nano', 'emacs', 'code', 'cursor', 'docker', 'brew',
                  'tauri', 'vite', 'make', 'cmake', 'export', 'source', 'alias',
                  'unalias', 'echo', 'env', 'chmod', 'chown', 'df', 'du', 'head',
                  'tail', 'less', 'more', 'which', 'curl', 'wget'
                ];
                if (strictShellCommands.includes(firstWord)) {
                  return false;
                }
                const triggerWords = [
                  'hey', 'can you', 'please', 'show', 'create', 'delete', 'find', 'list', 'update', 'install', 'setup', 'how do',
                  'turn', 'enable', 'disable', 'connect', 'disconnect', 'start', 'stop', 'open', 'close', 'check', 'scan',
                  'what', 'where', 'why', 'who', 'when', 'how', 'tell', 'give', 'make', 'set', 'get', 'switch', 'change',
                  'reboot', 'restart', 'shutdown', 'kill', 'search', 'help', 'explain', 'all', 'any', 'every', 'display',
                  'status', 'info', 'view', 'query', 'inspect', 'diagnose', 'test', 'i want', 'i need', 'need', 'want', 'my', 'our',
                  'go to', 'navigate', 'enter', 'is', 'are', 'which', 'whose', 'whether'
                ];
                const domainKeywords = [
                  'wifi', 'bluetooth', 'battery', 'network', 'networks', 'device', 'devices', 'volume', 'screen',
                  'brightness', 'cpu', 'gpu', 'ram', 'storage', 'disk', 'process', 'processes', 'task', 'tasks', 'service', 'services', 'daemon', 'daemons', 'pid', 'port', 'ports', 'socket', 'sockets', 'temperature', 'uptime', 'airpods', 'headphones',
                  'folder', 'fodler', 'directory', 'dir', 'downloads', 'donwloads', 'downlods', 'desktop', 'documents', 'pictures',
                  'movies', 'music', 'content of', 'contents of'
                ];
                const normalized = text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, ''); // strip weird hidden chars if any
                const startsWithTrigger = triggerWords.some(w => normalized.startsWith(w.replace(/[^a-z0-9 ]/g, '')));
                const containsDomainKeyword = domainKeywords.some(kw => normalized.includes(kw));
                return startsWithTrigger || containsDomainKeyword;
              };

              console.log("[TerminalView] Full text intercepted:", fullText);
              console.log("[TerminalView] Extracted command:", commandText);
              
              const cleanCmd = commandText.trim();
              const lowerCmd = cleanCmd.toLowerCase().replace(/[^a-z0-9\/~\-._ ]/g, '').trim();

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

              // Intercept natural language directory navigation and execute directly in interactive PTY shell
              const backCmds = ['go back', 'navigate back', 'move back', 'step back', 'go backward', 'go up', 'navigate up', 'move up', 'up a folder', 'up a dir', 'up a directory', 'go out', 'parent folder', 'parent directory', 'exit folder', 'exit directory', 'back'];
              const homeCmds = ['go home', 'navigate home', 'move home', 'take me home', 'home folder', 'home directory', 'return home', 'go to home', 'navigate to home', 'switch to home', 'cd home'];
              if (backCmds.includes(lowerCmd)) {
                notifyNavigation('..');
                await sessionManager.write(currentSessionId!, '\x03');
                term.write('\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32mcd ..\x1b[0m\r\n');
                setTimeout(() => sessionManager.write(currentSessionId!, 'cd ..\r'), 80);
                return;
              } else if (homeCmds.includes(lowerCmd)) {
                notifyNavigation('~');
                await sessionManager.write(currentSessionId!, '\x03');
                term.write('\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32mcd ~\x1b[0m\r\n');
                setTimeout(() => sessionManager.write(currentSessionId!, 'cd ~\r'), 80);
                return;
              } else if (/^(?:go to|navigate to|move to|switch to|jump to|enter|cd into|goto)\s+(.+)$/i.test(cleanCmd)) {
                const match = cleanCmd.match(/^(?:go to|navigate to|move to|switch to|jump to|enter|cd into|goto)\s+(.+)$/i);
                if (match && match[1]) {
                  let target = match[1].replace(/\s+(?:folder|fodler|directory|dir)$/i, '').trim();
                  const knownDirs: Record<string, string> = {
                    'downloads': '~/Downloads', 'donwloads': '~/Downloads',
                    'desktop': '~/Desktop', 'documents': '~/Documents',
                    'pictures': '~/Pictures', 'music': '~/Music',
                    'movies': '~/Movies', 'applications': '~/Applications',
                    'home': '~', 'root': '/'
                  };
                  const lowerTarget = target.toLowerCase();
                  if (knownDirs[lowerTarget]) {
                    target = knownDirs[lowerTarget];
                  }
                  notifyNavigation(target.replace(/["']/g, ''));
                  const cdCmd = target.includes(' ') && !target.startsWith('"') && !target.startsWith("'") ? `cd "${target}"` : `cd ${target}`;
                  await sessionManager.write(currentSessionId!, '\x03');
                  term.write(`\r\n\x1b[36m[AI Navigation] Translated command to: \x1b[1;32m${cdCmd}\x1b[0m\r\n`);
                  setTimeout(() => sessionManager.write(currentSessionId!, `${cdCmd}\r`), 80);
                  return;
                }
              }

              if (isNaturalLanguage(commandText.trim())) {
                console.log("[TerminalView] Matched natural language!");
                // Send Ctrl+C to cancel the shell's buffer
                await sessionManager.write(currentSessionId, '\x03');
                term.write('\r\n\x1b[35m[AI Planner] Analyzing request...\x1b[0m\r\n');
                
                // Trigger planner asynchronously
                planner.plan({
                  goal: commandText,
                  context: { os: 'mac', shell: 'zsh', cwd: 'unknown' }
                }).then(response => {
                  if (response.success && response.workflow) {
                    term.write(`\r\n\x1b[32m[AI Planner] Created workflow: ${response.workflow.name}\x1b[0m\r\n`);
                    term.write(`\x1b[36mSummary: ${response.summary}\x1b[0m\r\n`);
                    if (response.intentResult) {
                      term.write(`\x1b[35m[Local Intent AI] Active Model: ${response.intentResult.modelId} (${response.intentResult.providerId}) | Confidence: ${Math.round(response.intentResult.confidence * 100)}%\x1b[0m\r\n`);
                      if (response.intentResult.tasks && response.intentResult.tasks.length > 1) {
                        term.write(`\x1b[33m[Execution Plan] Sequential Tasks (${response.intentResult.tasks.length}):\x1b[0m\r\n`);
                        response.intentResult.tasks.forEach((t, idx) => {
                          term.write(`   ${idx + 1}. Tool: \x1b[1;36m${t.tool}\x1b[0m | Entities: ${JSON.stringify(t.entities)}\r\n`);
                        });
                      }
                    }
                    
                    // Instantiate execution dependencies
                    const permissionManager = new PermissionManager();
                    const securityEngine = new SecurityEngine();
                    const policyEngine = new PolicyEngine();
                    const auditLogger = new AuditLogger();
                    const executionEngine = new ExecutionEngine(
                      capabilityManager, permissionManager, securityEngine, policyEngine, auditLogger
                    );
                    const workflowEngine = new WorkflowEngine();
                    
                    const runtime = new AgentRuntime(workflowEngine, executionEngine, planner, response.workflow);
                    
                    runtime.on((event, payload) => {
                      if (event === 'ApprovalRequested' && payload?.plan) {
                        const p = payload.plan;
                        term.write(`\r\n\x1b[1;33m[Security Engine: ${p.riskLevel || 'ADMIN'} RISK ACTION DETECTED]\x1b[0m\r\n`);
                        term.write(`  • Operation: \x1b[1;36m${p.capabilityId}\x1b[0m\r\n`);
                        term.write(`  • Target: \x1b[1;33m${p.parameters?.path || p.parameters?.source || p.parameters?.directory || JSON.stringify(p.parameters)}\x1b[0m\r\n`);
                        term.write(`  • Explanation: ${p.explanation || 'Destructive filesystem operation requires authorization'}\r\n`);
                        term.write(`\x1b[36m[Security Authentication]\x1b[0m Verifying user administrative authorization & system security credentials...\r\n`);
                        return;
                      } else if (event === 'ApprovalGranted') {
                        term.write(`\x1b[1;32m[Security Authentication Verified]\x1b[0m Authorization confirmed for secure filesystem execution.\r\n`);
                        return;
                      }

                      // Format log nicely
                      let msg = payload?.log || event;
                      if (event === 'VerificationFailed' && payload?.error) {
                        msg = `VerificationFailed: ${payload.error.message || payload.error.code || 'Unknown error'}`;
                      } else if (event === 'StepCompleted' && payload?.step) {
                        msg = `StepCompleted: ${payload.step.name}`;
                        if (payload.data?.stdout) {
                          term.write(`\r\n\x1b[32m[Command Output]\x1b[0m\r\n${String(payload.data.stdout).replace(/\n/g, '\r\n')}\r\n`);
                        } else if (payload.data?.stderr) {
                          term.write(`\r\n\x1b[33m[Command Output (Stderr)]\x1b[0m\r\n${String(payload.data.stderr).replace(/\n/g, '\r\n')}\r\n`);
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
                            term.write(`\r\n\x1b[32m[Capability Output]\x1b[0m\r\n${formatted}\r\n`);
                          }
                        }
                      }
                      term.write(`\x1b[34m[AgentRuntime] ${msg}\x1b[0m\r\n`);
                    });

                    term.write(`\x1b[33mStarting Agent Runtime...\x1b[0m\r\n`);
                    runtime.start().then(summary => {
                      term.write(`\r\n\x1b[35m[Execution Summary]\x1b[0m\r\n`);
                      term.write(`Goal: ${summary.goal}\r\n`);
                      term.write(`Result: ${summary.finalResult}\r\n`);
                      term.write(`Time: ${summary.executionTimeMs.toFixed(2)}ms\r\n`);
                      term.write(`Completed: ${summary.completedSteps.length}\r\n`);
                      term.write(`Failed: ${summary.failedSteps.length}\r\n`);
                      term.write(`Retries: ${Object.keys(summary.retries).length}\r\n`);
                      term.write(`Repairs: ${summary.repairCount}\r\n`);
                      term.write('\r\n');
                      sessionManager.write(currentSessionId!, '\r');
                    });
                  } else {
                    term.write(`\x1b[31m[AI Planner Failed] ${response.error?.message || 'Unknown error'}\x1b[0m\r\n\r\n`);
                    sessionManager.write(currentSessionId!, '\r');
                  }
                });
                
                return; // Do NOT send the \r to the shell
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
                const promptMatch = fullText.match(/.*[$%#>]\s*/);
                const commandText = promptMatch ? fullText.substring(promptMatch[0].length).trimStart() : fullText.trimStart();
                
                if (commandText.length > 0) {
                  const suggestions = await autocompleteEngine.getSuggestions({ 
                    currentInput: commandText, 
                    cwd: 'unknown',
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
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        display: isActive ? 'block' : 'none'
      }} 
    />
  );
};
