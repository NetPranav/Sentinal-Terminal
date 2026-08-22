import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { invoke } from '@tauri-apps/api/core';
import { SessionManager } from '../domain/SessionManager';
import { ToolLoader } from '../tools/loader/ToolLoader';
import { AppAliasRegistry } from '../domain/capabilities/AppAliasRegistry';
import { AgentLoop } from '../ai/agent/AgentLoop';
import { formatAgentEvent, formatDataOutput } from './OutputFormatter';

import { AutocompleteEngine } from '../domain/autocomplete/AutocompleteEngine';
import { HistoryProvider } from '../domain/autocomplete/HistoryProvider';
import { GhostTextRenderer } from '../ui/components/GhostText';
import { ThemeManager } from '../ui/theme/ThemeManager';
import { ShellAdapter } from '../domain/shell/ShellAdapter';
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
      scrollback: 100000,
      allowProposedApi: true,
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
          const shellAdapter = ShellAdapter.getInstance();
          const defaultProfile = shellAdapter.detectLoginShell();
          currentSessionId = await sessionManager.createSession(
            term.rows, 
            term.cols, 
            defaultProfile.defaultPath, 
            currentPath || undefined, 
            true
          );
          setSessionId(currentSessionId);
          onSessionCreated?.(currentSessionId);
        } else {
          await sessionManager.resize(currentSessionId, term.rows, term.cols);
        }

        outputCallback = (data: Uint8Array) => {
          term.write(data);
        };

        sessionManager.onOutput(currentSessionId, outputCallback);

        // Initialize AI Tool Registry & Agent Loop
        const toolLoader = new ToolLoader();
        toolLoader.loadAll();
        
        const agentLoop = new AgentLoop(toolLoader.getState());

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

                // Cancel the shell echo of the > command
                await sessionManager.write(currentSessionId!, '\x03');

                // Set up event listener for live output
                agentLoop.onEvent((event) => {
                  writeTerm(formatAgentEvent(event));
                  // Show structured data (file lists, devices, etc.) when available
                  if (event.data && (event.type === 'tool_done' || event.type === 'done')) {
                    const dataOutput = formatDataOutput(event.data);
                    if (dataOutput) writeTerm(dataOutput);
                  }
                });

                // Run the agent loop
                agentLoop.run(aiGoal, { os: 'mac', cwd: currentPath || '~' }).then(result => {
                  // Handle clear terminal command
                  if (result.steps.some(s => s.tool === '__clear__')) {
                    term.clear();
                    writeTerm('\x1b[2J\x1b[H');
                    sessionManager.write(currentSessionId!, '\r');
                    return;
                  }

                  // Handle directory navigation
                  if (result.cdPath) {
                    notifyNavigation(result.cdPath);
                    const cdCmd = result.cdPath.includes(' ') && !result.cdPath.startsWith('"') && !result.cdPath.startsWith("'") ? `cd "${result.cdPath}"` : `cd ${result.cdPath}`;
                    setTimeout(() => sessionManager.write(currentSessionId!, `${cdCmd}\r`), 50);
                  } else {
                    writeTerm('\r\n');
                    sessionManager.write(currentSessionId!, '\r');
                  }
                }).catch(err => {
                  writeTerm(`\r\n\x1b[1;31m  ✗ ${err.message || 'Something went wrong'}\x1b[0m\r\n\r\n`);
                  sessionManager.write(currentSessionId!, '\r');
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
