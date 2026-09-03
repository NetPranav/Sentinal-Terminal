import React, { useState, useEffect } from 'react';
import { ListeningPortInfo, ProcessPortManager } from '../../domain/process/ProcessPortManager';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';

export interface ProcessPortManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProcessPortManagerDrawer: React.FC<ProcessPortManagerDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const [ports, setPorts] = useState<ListeningPortInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [freeingPort, setFreeingPort] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus | null>(null);

  const fetchPortsAndStatus = async () => {
    setIsLoading(true);
    try {
      const [portData, aiStatus] = await Promise.all([
        ProcessPortManager.getInstance().getListeningPorts(),
        EmbeddedEngineManager.getInstance().getStatus()
      ]);
      setPorts(portData);
      setEmbeddedStatus(aiStatus);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedbackMsg(null);
      fetchPortsAndStatus();
      const interval = setInterval(fetchPortsAndStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleFreePort = async (port: number) => {
    setFreeingPort(port);
    try {
      const ok = await ProcessPortManager.getInstance().freePort(port);
      if (ok) {
        setFeedbackMsg(`Successfully freed port ${port}!`);
        await fetchPortsAndStatus();
      } else {
        setFeedbackMsg(`Failed to terminate process on port ${port}.`);
      }
    } catch {
      setFeedbackMsg(`Error freeing port ${port}.`);
    } finally {
      setFreeingPort(null);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 99990
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          width: '460px',
          maxWidth: '92vw',
          height: '100%',
          backgroundColor: 'rgba(17, 21, 33, 0.96)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔌</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Active Ports & Activities</h3>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                {ports.length} listening network port{ports.length === 1 ? '' : 's'} • Hardware & AI Status
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchPortsAndStatus}
              disabled={isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.7)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div style={{
            margin: '12px 20px 0',
            padding: '8px 12px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#38bdf8'
          }}>
            {feedbackMsg}
          </div>
        )}

        {/* AI & Background Task HUD Card */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{
            backgroundColor: 'rgba(56, 189, 248, 0.06)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                <span>⚡</span>
                <span>Sentinel Embedded AI</span>
              </div>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: embeddedStatus?.modelDownloaded ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: embeddedStatus?.modelDownloaded ? '#4ade80' : '#facc15',
                fontWeight: 600
              }}>
                {embeddedStatus?.modelDownloaded ? 'Model Ready (Qwen 2.5 3B)' : 'Model Not Downloaded'}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.4 }}>
              {embeddedStatus?.modelDownloaded
                ? 'Model stored in ~/.sentinel/models/ • Metal GPU acceleration ready'
                : 'Download model via Command Palette (Cmd+Shift+P > "Sentinel Embedded AI") or type ">setup-ai"'}
            </div>

            {embeddedStatus?.isRunning && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#4ade80', marginTop: '2px' }}>
                <span>● Server Active on Port {embeddedStatus.port}</span>
                {embeddedStatus.pid && <span>• PID {embeddedStatus.pid}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Port list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {ports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '13px'
            }}>
              {isLoading ? 'Scanning active ports...' : 'No listening ports detected.'}
            </div>
          ) : (
            ports.map(p => (
              <div
                key={p.port}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#38bdf8'
                    }}>
                      :{p.port}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#4ade80',
                      fontWeight: 600
                    }}>
                      ● {p.status || 'LISTEN'}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      {p.category || 'Service'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '2px' }}>
                    {p.description || p.processName}
                  </div>

                  <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
                    PID {p.pid} • {p.processName} • {p.protocol}
                  </div>
                </div>

                <button
                  onClick={() => handleFreePort(p.port)}
                  disabled={freeingPort === p.port}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: freeingPort === p.port ? 'not-allowed' : 'pointer',
                    opacity: freeingPort === p.port ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  {freeingPort === p.port ? 'Freeing...' : 'Free Port'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          <span>Cmd+Shift+P to toggle</span>
          <span>Auto-refreshes every 3s</span>
        </div>
      </div>
    </div>
  );
};
