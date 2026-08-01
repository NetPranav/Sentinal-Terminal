import React, { useState, useEffect } from 'react';
import { InstallerService, IntegrationStatus } from '../../domain/integration/InstallerService';

interface InstallerWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallerWizard: React.FC<InstallerWizardProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<IntegrationStatus>({
    cliInstalled: false,
    finderEnabled: false,
    vscodeConfigured: false,
    cursorConfigured: false,
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
        width: '560px',
        backgroundColor: '#161618',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.3px', color: '#ffffff' }}>
            Would you like to configure Sentinel as your primary terminal?
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)', margin: 0, lineHeight: 1.5 }}>
            Sentinel provides deep operating system integration on macOS, making it effortless to open sessions from Finder, your CLI, and your favorite IDEs.
          </p>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Item 1: CLI Launcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Command Line Launcher (`sentinel`)</div>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Install executable to `/usr/local/bin/sentinel`
              </div>
            </div>
            <button
              onClick={handleInstallCli}
              disabled={loading || status.cliInstalled}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: status.cliInstalled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: status.cliInstalled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: status.cliInstalled ? '#10b981' : '#ffffff',
                fontSize: '13px',
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
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Finder Quick Actions</div>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Right-click any folder → Services → Open in Sentinel
              </div>
            </div>
            <button
              onClick={handleEnableFinder}
              disabled={loading || status.finderEnabled}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: status.finderEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: status.finderEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: status.finderEnabled ? '#10b981' : '#ffffff',
                fontSize: '13px',
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
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>VS Code & Cursor IDE Profiles</div>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                Inject integrated terminal configuration into editor settings
              </div>
            </div>
            <button
              onClick={handleConfigureIdes}
              disabled={loading || (status.vscodeConfigured && status.cursorConfigured)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: (status.vscodeConfigured || status.cursorConfigured) ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: (status.vscodeConfigured || status.cursorConfigured) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: (status.vscodeConfigured || status.cursorConfigured) ? '#10b981' : '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: (status.vscodeConfigured && status.cursorConfigured) ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {(status.vscodeConfigured || status.cursorConfigured) ? '✓ Configured' : 'Configure'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={handleDismiss}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Not Now
          </button>
          <button
            onClick={handleInstallAll}
            disabled={loading}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
              transition: 'background-color 0.2s'
            }}
          >
            Configure All Integrations
          </button>
        </div>
      </div>
    </div>
  );
};
