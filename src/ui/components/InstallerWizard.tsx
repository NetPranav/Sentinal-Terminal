import React, { useState, useEffect } from 'react';
import { InstallerService, IntegrationStatus } from '../../domain/integration/InstallerService';
import { Zap, Eye, Check } from 'lucide-react';

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
    const current = await installer.checkStatus();
    setStatus(current);
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
    await installer.installCli();
    await installer.enableFinderIntegration();
    await installer.configureVsCodeIntegration();
    await installer.configureCursorIntegration();
    await refreshStatus();
    setLoading(false);
    setMessage('✓ All desktop integrations successfully configured!');
    localStorage.setItem('sentinel_onboarded', 'true');
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
    if (res.success) setMessage('✓ Finder Quick Actions registered!');
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <div style={{
        width: '580px',
        maxWidth: '92vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#161618',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '28px 32px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.3px', color: '#ffffff' }}>
            Welcome to Sentinel Terminal
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)', margin: 0, lineHeight: 1.5 }}>
            Configure your terminal layout preferences and desktop integrations.
          </p>
        </div>

        {/* Experience Preference Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Choose your Terminal Experience
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Zen Mode */}
            <div
              onClick={() => handleSelectMode('zen')}
              style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: uiMode === 'zen' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: uiMode === 'zen' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'all 0.18s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: uiMode === 'zen' ? '#38bdf8' : '#ffffff' }}>
                  <Zap size={14} />
                  <span>Zen Mode</span>
                </span>
                {uiMode === 'zen' && <Check size={14} color="#38bdf8" />}
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.4 }}>
                Minimalist, distraction-free. Controls smoothly fade in on hover.
              </span>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500, marginTop: '2px' }}>
                Recommended
              </span>
            </div>

            {/* Visual Mode */}
            <div
              onClick={() => handleSelectMode('visual')}
              style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: uiMode === 'visual' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: uiMode === 'visual' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'all 0.18s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', color: uiMode === 'visual' ? '#c084fc' : '#ffffff' }}>
                  <Eye size={14} />
                  <span>Visual Mode</span>
                </span>
                {uiMode === 'visual' && <Check size={14} color="#c084fc" />}
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.4 }}>
                On-screen buttons always visible for splits, tabs, and tools.
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500, marginTop: '2px' }}>
                Classic controls
              </span>
            </div>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: message.startsWith('Error') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${message.startsWith('Error') ? '#ef4444' : '#10b981'}`,
            color: message.startsWith('Error') ? '#fca5a5' : '#6ee7b7',
            fontSize: '13px',
            fontWeight: 500
          }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Desktop & Environment Integrations
          </div>

          {/* Item 1: CLI Launcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Command Line Launcher (`sentinel`)</div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Install executable to `/usr/local/bin/sentinel`
              </div>
            </div>
            <button
              onClick={handleInstallCli}
              disabled={loading || status.cliInstalled}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: status.cliInstalled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: status.cliInstalled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: status.cliInstalled ? '#10b981' : '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: status.cliInstalled ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status.cliInstalled ? '✓ Installed' : 'Install'}
            </button>
          </div>

          {/* Item 2: Finder Quick Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Desktop / File Manager Actions</div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Right-click any folder → Open in Sentinel
              </div>
            </div>
            <button
              onClick={handleEnableFinder}
              disabled={loading || status.finderEnabled}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: status.finderEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: status.finderEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: status.finderEnabled ? '#10b981' : '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: status.finderEnabled ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status.finderEnabled ? '✓ Enabled' : 'Enable'}
            </button>
          </div>

          {/* Item 3: IDE Profiles */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>VS Code & Cursor IDE Profiles</div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Inject terminal configuration into editor settings
              </div>
            </div>
            <button
              onClick={handleConfigureIdes}
              disabled={loading || (status.vscodeConfigured && status.cursorConfigured)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: (status.vscodeConfigured || status.cursorConfigured) ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: (status.vscodeConfigured || status.cursorConfigured) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: (status.vscodeConfigured || status.cursorConfigured) ? '#10b981' : '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: (status.vscodeConfigured && status.cursorConfigured) ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {(status.vscodeConfigured || status.cursorConfigured) ? '✓ Configured' : 'Configure'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Skip for Now
          </button>
          <button
            onClick={handleInstallAll}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              transition: 'background-color 0.2s'
            }}
          >
            Finish & Save
          </button>
        </div>
      </div>
    </div>
  );
};
