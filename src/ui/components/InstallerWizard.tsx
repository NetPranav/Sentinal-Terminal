import React, { useState, useEffect } from 'react';
import { InstallerService, IntegrationStatus } from '../../domain/integration/InstallerService';
import { Terminal, Folder, Code2, Check, ExternalLink } from 'lucide-react';
import { isLinux } from '../../shared/platform';

interface InstallerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUiMode?: (mode: 'zen' | 'visual') => void;
}

export const InstallerWizard: React.FC<InstallerWizardProps> = ({ isOpen, onClose, onSelectUiMode }) => {
  const [status, setStatus] = useState<IntegrationStatus>({
    cliInstalled: false,
    finderEnabled: false,
    vscodeConfigured: false,
    cursorConfigured: false,
  });
  const [uiMode, setUiMode] = useState<'zen' | 'visual'>(() => {
    return (localStorage.getItem('sentinel_ui_mode') as 'zen' | 'visual') || 'zen';
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const installer = InstallerService.getInstance();

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
    }
  }, [isOpen]);

  const refreshStatus = async () => {
    try {
      const current = await installer.checkStatus();
      setStatus(current);
    } catch {
      // Non-fatal in mocked or restricted environments
    }
  };

  const handleSelectMode = (mode: 'zen' | 'visual') => {
    setUiMode(mode);
    localStorage.setItem('sentinel_ui_mode', mode);
    if (onSelectUiMode) onSelectUiMode(mode);
    window.dispatchEvent(new CustomEvent('sentinel:ui-mode-changed', { detail: mode }));
  };

  const handleInstallAll = async () => {
    setLoading(true);
    setMessage('Installing desktop integrations...');
    try {
      await installer.installCli();
      await installer.enableFinderIntegration();
      await installer.configureVsCodeIntegration();
      await installer.configureCursorIntegration();
      await refreshStatus();
      setMessage('✓ All desktop integrations successfully configured!');
      localStorage.setItem('sentinel_onboarded', 'true');
      setTimeout(() => {
        onClose();
      }, 750);
    } catch (err: any) {
      setMessage(`Error: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallCli = async () => {
    setLoading(true);
    const res = await installer.installCli();
    if (res.success) setMessage('✓ CLI launcher installed!');
    else setMessage(`Error: ${res.error}`);
    await refreshStatus();
    setLoading(false);
  };

  const handleEnableFinder = async () => {
    setLoading(true);
    const res = await installer.enableFinderIntegration();
    if (res.success) setMessage(isLinux() ? '✓ Linux File Manager scripts registered!' : '✓ Finder Quick Actions registered!');
    else setMessage(`Error: ${res.error}`);
    await refreshStatus();
    setLoading(false);
  };

  const handleConfigureIdes = async () => {
    setLoading(true);
    await installer.configureVsCodeIntegration();
    await installer.configureCursorIntegration();
    setMessage('✓ VS Code and Cursor profiles configured!');
    await refreshStatus();
    setLoading(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('sentinel_onboarded', 'true');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#090b10',
      background: 'radial-gradient(ellipse 90% 45% at 50% -5%, rgba(255, 255, 255, 0.04), transparent), #090b10',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      color: '#ffffff'
    }}>
      {/* Top Application Header Bar */}
      <div
        className="window-drag-region"
        style={{
          height: '40px',
          padding: isLinux() ? '0 24px' : '0 24px 0 78px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          backgroundColor: '#07080d',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff'
          }}>
            <Terminal size={12} strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 600, color: '#ffffff', letterSpacing: '-0.2px' }}>Sentinel Terminal</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.25)' }}>/</span>
          <span>Workspace Onboarding & Environment Setup</span>
        </div>
      </div>

      {/* Main Spacious Onboarding Container */}
      <div style={{
        maxWidth: '1360px',
        width: '100%',
        margin: '0 auto',
        padding: '22px 40px 28px 40px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        flex: 1
      }}>
        {/* Screen Header */}
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.4px', color: '#ffffff' }}>
            Welcome to Sentinel Terminal
          </h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.65)', margin: 0, lineHeight: 1.45 }}>
            Configure your terminal experience profile, layout density, and native desktop environment integrations.
          </p>
        </div>

        {/* Section 1: Choose Your Terminal Experience */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Choose your Terminal Experience
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
              Keyboard shortcut: <kbd style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', fontSize: '10px' }}>Ctrl+Shift+Z</kbd>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
            {/* Zen Mode Card */}
            <div
              onClick={() => handleSelectMode('zen')}
              style={{
                padding: '16px',
                borderRadius: '13px',
                backgroundColor: uiMode === 'zen' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                border: uiMode === 'zen' ? '1.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: uiMode === 'zen' ? '0 0 0 1px #ffffff, 0 14px 36px rgba(0, 0, 0, 0.75)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Large 16:9 Real Screen Preview */}
              <div style={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: '#05070a',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              }}>
                <img
                  src="/previews/zen_mode_preview.png"
                  alt="Zen Mode Experience Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              {/* Bottom Mode Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: uiMode === 'zen' ? '1.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.3)',
                      backgroundColor: uiMode === 'zen' ? '#ffffff' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}>
                      {uiMode === 'zen' && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0a0a0c' }} />
                      )}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>
                      Zen Mode
                    </span>
                  </div>

                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    Recommended
                  </span>
                </div>

                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5, paddingLeft: '24px' }}>
                  Distraction-free focus with auto-hiding chrome. Action buttons stay hidden until top header hover. Full multi-pane, tab & AI support.
                </span>
              </div>
            </div>

            {/* Visual Mode Card */}
            <div
              onClick={() => handleSelectMode('visual')}
              style={{
                padding: '16px',
                borderRadius: '13px',
                backgroundColor: uiMode === 'visual' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                border: uiMode === 'visual' ? '1.5px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: uiMode === 'visual' ? '0 0 0 1px #ffffff, 0 14px 36px rgba(0, 0, 0, 0.75)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Large 16:9 Real Screen Preview */}
              <div style={{
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backgroundColor: '#05070a',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
              }}>
                <img
                  src="/previews/visual_mode_preview.png"
                  alt="Visual Mode Experience Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              {/* Bottom Mode Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: uiMode === 'visual' ? '1.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.3)',
                      backgroundColor: uiMode === 'visual' ? '#ffffff' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}>
                      {uiMode === 'visual' && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0a0a0c' }} />
                      )}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>
                      Visual Mode
                    </span>
                  </div>

                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'rgba(255, 255, 255, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)'
                  }}>
                    Classic Controls
                  </span>
                </div>

                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5, paddingLeft: '24px' }}>
                  Traditional GUI workflow with persistent controls. Action buttons stay always visible for splits, tabs, and workflows. Full multi-pane, tab & AI support.
                </span>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={15} />
            <span>{message}</span>
          </div>
        )}

        {/* Section 2: Desktop & Environment Integrations (Spacious Horizontal Rectangles) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Desktop & Environment Integrations
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {/* Box 1: CLI Launcher */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '18px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '12px',
              minHeight: '180px',
              boxSizing: 'border-box'
            }}>
              <div>
                {/* Header: Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0
                  }}>
                    <Terminal size={15} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#ffffff', lineHeight: 1.3 }}>
                    Command Line Launcher (<code style={{ fontSize: '11.5px', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '4px' }}>sentinel</code>)
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '11.8px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
                  Installs a user-space launcher into your PATH. Enables launching Sentinel from any terminal prompt, bash/zsh script, or application launcher (Rofi, Wofi, dmenu) via <code style={{ fontSize: '11px', color: '#ffffff', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 5px', borderRadius: '3px' }}>sentinel &lt;path&gt;</code>.
                </div>
              </div>

              {/* Bottom Row: Path badge on left, Action Button on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: 'ui-monospace, monospace',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isLinux() ? '~/.local/bin/sentinel' : '/usr/local/bin/sentinel'}</span>
                  <span>•</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)', flexShrink: 0 }}>User Space</span>
                </div>

                <button
                  onClick={handleInstallCli}
                  disabled={loading || status.cliInstalled}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: status.cliInstalled ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.18)',
                    backgroundColor: status.cliInstalled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                    color: status.cliInstalled ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: status.cliInstalled ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  {status.cliInstalled ? '✓ Installed' : 'Install'}
                </button>
              </div>
            </div>

            {/* Box 2: File Manager Actions */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '18px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '12px',
              minHeight: '180px',
              boxSizing: 'border-box'
            }}>
              <div>
                {/* Header: Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0
                  }}>
                    <Folder size={15} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#ffffff', lineHeight: 1.3 }}>
                    {isLinux() ? 'Linux Desktop / File Manager Actions' : 'Desktop / File Manager Actions'}
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '11.8px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
                  Registers desktop context menu actions with your graphical file manager (GNOME Nautilus, Nemo, Dolphin, Thunar). Right-click any folder or desktop workspace to spawn Sentinel there.
                </div>
              </div>

              {/* Bottom Row: Path badge on left, Action Button on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: 'ui-monospace, monospace',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isLinux() ? '~/.local/share/nautilus/scripts/' : '~/Library/Services/'}</span>
                  <span>•</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)', flexShrink: 0 }}>Context Hook</span>
                </div>

                <button
                  onClick={handleEnableFinder}
                  disabled={loading || status.finderEnabled}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: status.finderEnabled ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.18)',
                    backgroundColor: status.finderEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                    color: status.finderEnabled ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: status.finderEnabled ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  {status.finderEnabled ? '✓ Enabled' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Box 3: IDE Profiles */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '18px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: '12px',
              minHeight: '180px',
              boxSizing: 'border-box'
            }}>
              <div>
                {/* Header: Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0
                  }}>
                    <Code2 size={15} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#ffffff', lineHeight: 1.3 }}>
                    VS Code & Cursor IDE Profiles
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: '11.8px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
                  Safely registers Sentinel under <code style={{ fontSize: '11px', color: '#ffffff', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 5px', borderRadius: '3px' }}>terminal.integrated.profiles.linux</code> in your IDE settings. Switch to Sentinel inside your editor's terminal dropdown.
                </div>
              </div>

              {/* Bottom Row: Path badge on left, Action Button on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: 'ui-monospace, monospace',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>~/.config/Code/User/settings.json</span>
                  <span>•</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)', flexShrink: 0 }}>Safe Merge</span>
                </div>

                <button
                  onClick={handleConfigureIdes}
                  disabled={loading || (status.vscodeConfigured && status.cursorConfigured)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    border: (status.vscodeConfigured || status.cursorConfigured) ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.18)',
                    backgroundColor: (status.vscodeConfigured || status.cursorConfigured) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                    color: (status.vscodeConfigured || status.cursorConfigured) ? '#ffffff' : 'rgba(255, 255, 255, 0.9)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: (status.vscodeConfigured && status.cursorConfigured) ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  {(status.vscodeConfigured || status.cursorConfigured) ? '✓ Configured' : 'Configure'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          marginTop: 'auto'
        }}>
          <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.5)' }}>
            All settings and integrations can be reconfigured anytime in Settings (<kbd style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.8)' }}>Ctrl+,</kbd>) or Command Palette.
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <button
              onClick={handleDismiss}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; }}
            >
              Skip for Now
            </button>
            <button
              onClick={handleInstallAll}
              disabled={loading}
              style={{
                padding: '10px 28px',
                borderRadius: '8px',
                border: '1px solid #ffffff',
                backgroundColor: '#ffffff',
                color: '#090b10',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 14px rgba(0, 0, 0, 0.6)',
                transition: 'opacity 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {loading ? 'Saving...' : 'Finish & Launch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

