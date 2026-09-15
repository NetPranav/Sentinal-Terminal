import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  RefreshCw, 
  X, 
  Cpu, 
  Trash2 
} from 'lucide-react';
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
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
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
          backgroundColor: 'rgba(18, 20, 25, 0.97)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-16px 0 48px rgba(0, 0, 0, 0.75)',
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
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={16} color="rgba(255, 255, 255, 0.75)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Active Ports & Activities</h3>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
                {ports.length} listening network port{ports.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchPortsAndStatus}
              disabled={isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '5px',
                color: 'rgba(255, 255, 255, 0.65)',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={11} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '5px',
                padding: '2px 6px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Feedback message banner */}
        {feedbackMsg && (
          <div style={{
            margin: '10px 16px 0',
            padding: '7px 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#f8fafc'
          }}>
            {feedbackMsg}
          </div>
        )}

        {/* AI & Background Task HUD Card */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#f8fafc' }}>
                <Cpu size={13} style={{ color: 'rgba(255, 255, 255, 0.65)' }} />
                <span>Sentinel In-App AI Engine</span>
              </div>
              <span style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: embeddedStatus?.modelDownloaded ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                color: embeddedStatus?.modelDownloaded ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontWeight: 500
              }}>
                {embeddedStatus?.modelDownloaded ? 'Qwen 2.5 3B' : 'Not Downloaded'}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', lineHeight: 1.4 }}>
              {embeddedStatus?.modelDownloaded
                ? 'Local offline weights loaded in ~/.sentinel/models/'
                : 'Download weights via Command Palette > "Sentinel Embedded AI"'}
            </div>

            {embeddedStatus?.isRunning && (
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
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
          padding: '12px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {ports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'rgba(255, 255, 255, 0.35)',
              fontSize: '12px'
            }}>
              {isLoading ? 'Scanning active ports...' : 'No listening ports detected.'}
            </div>
          ) : (
            ports.map(p => (
              <div
                key={p.port}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#ffffff'
                    }}>
                      :{p.port}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'rgba(255, 255, 255, 0.75)',
                      fontWeight: 500
                    }}>
                      {p.status || 'LISTEN'}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      color: 'rgba(255, 255, 255, 0.45)'
                    }}>
                      {p.category || 'Service'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.description || p.processName}
                  </div>

                  <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                    PID {p.pid} • {p.processName} • {p.protocol}
                  </div>
                </div>

                <button
                  onClick={() => handleFreePort(p.port)}
                  disabled={freeingPort === p.port}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.65)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: freeingPort === p.port ? 'not-allowed' : 'pointer',
                    opacity: freeingPort === p.port ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.color = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  }}
                >
                  <Trash2 size={11} />
                  <span>{freeingPort === p.port ? 'Freeing...' : 'Free'}</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.4)'
        }}>
          <span>Auto-refreshes every 3s</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '3px' }}>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
