import React, { useState, useEffect } from 'react';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';

export interface EmbeddedModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmbeddedModelManagerModal: React.FC<EmbeddedModelManagerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [status, setStatus] = useState<EmbeddedStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const refreshStatus = async () => {
    const s = await EmbeddedEngineManager.getInstance().getStatus();
    setStatus(s);
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      const interval = setInterval(refreshStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadMsg('Downloading Qwen 2.5 Coder 3B GGUF (~1.9 GB) into ~/.sentinel/models/ ...');
    
    const success = await EmbeddedEngineManager.getInstance().downloadRecommendedModel((p) => {
      setDownloadMsg(`Downloading... ${p.percent}% complete`);
    });

    setIsDownloading(false);
    if (success) {
      setDownloadMsg('Download complete! Starting in-app engine...');
      await EmbeddedEngineManager.getInstance().startEngine();
      await refreshStatus();
      setTimeout(() => setDownloadMsg(null), 3000);
    } else {
      setDownloadMsg('Download failed or cancelled. Please check internet connection.');
    }
  };

  const handleToggleEngine = async () => {
    if (!status) return;
    setIsActionBusy(true);
    if (status.isRunning) {
      await EmbeddedEngineManager.getInstance().stopEngine();
    } else {
      await EmbeddedEngineManager.getInstance().startEngine();
    }
    await refreshStatus();
    setIsActionBusy(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99996
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '680px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: 'rgba(16, 20, 31, 0.96)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>Sentinel Embedded AI</h2>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Native in-app local intelligence — Zero Ollama dependency
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
          {/* Status banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: status?.isRunning ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: status?.isRunning ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: status?.isRunning ? '#22c55e' : '#eab308'
              }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {status?.isRunning ? 'Embedded Engine Active' : 'Embedded Engine Idle'}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Hardware: Apple Silicon Metal GPU | Port: {status?.port || 8847}
                </div>
              </div>
            </div>

            {status?.modelDownloaded && (
              <button
                disabled={isActionBusy}
                onClick={handleToggleEngine}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: status?.isRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: status?.isRunning ? '#f87171' : '#4ade80',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {status?.isRunning ? 'Stop Engine' : 'Start Engine'}
              </button>
            )}
          </div>

          {/* Download progress alert */}
          {downloadMsg && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#38bdf8'
            }}>
              ⏳ {downloadMsg}
            </div>
          )}

          {/* Model Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>
                  Qwen 2.5 Coder 3B Instruct
                </h3>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  Primary Sweet-Spot Architecture | 4-bit Quantized (Q4_K_M)
                </span>
              </div>
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '4px',
                backgroundColor: status?.modelDownloaded ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                color: status?.modelDownloaded ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: 600
              }}>
                {status?.modelDownloaded ? 'Installed ✓' : 'Not Downloaded'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
              Engineered specifically for terminal automation and developer workflows. High-accuracy zero-shot bash translation, strict JSON schema compliance, and autonomous multi-phase error recovery running at 70–90 tokens/sec on Apple Silicon.
            </p>

            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
              <span>📦 Download Size: ~1.93 GB</span>
              <span>🧠 RAM Footprint: ~2.4 GB</span>
              <span>⚡ Metal GPU Acceleration: Yes</span>
            </div>

            {!status?.modelDownloaded && (
              <button
                disabled={isDownloading}
                onClick={handleDownload}
                style={{
                  marginTop: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#38bdf8',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDownloading ? 'not-allowed' : 'pointer',
                  opacity: isDownloading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isDownloading ? 'Downloading Model (~1.9 GB)...' : '⚡ 1-Click Download & Activate Qwen 2.5 Coder 3B (1.9 GB)'}
              </button>
            )}
          </div>

          {/* Information box */}
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.45)',
            lineHeight: 1.5,
            padding: '12px 14px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px'
          }}>
            💡 <strong>Why Embedded?</strong> Sentinel runs its own Metal-accelerated inference engine without background daemons, port 11434 collisions, or complex installation steps. If you prefer using an existing external Ollama instance or remote server, you can switch providers anytime in AI Settings.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.45)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Models stored in ~/.sentinel/models/</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
