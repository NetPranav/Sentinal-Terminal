import React, { useState, useEffect } from 'react';
import { ListeningPortInfo, ProcessPortManager } from '../../domain/process/ProcessPortManager';

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

  const fetchPorts = async () => {
    setIsLoading(true);
    try {
      const data = await ProcessPortManager.getInstance().getListeningPorts();
      setPorts(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFeedbackMsg(null);
      fetchPorts();
    }
  }, [isOpen]);

  const handleFreePort = async (port: number) => {
    setFreeingPort(port);
    try {
      const ok = await ProcessPortManager.getInstance().freePort(port);
      if (ok) {
        setFeedbackMsg(`Successfully freed port ${port}!`);
        await fetchPorts();
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
          width: '420px',
          maxWidth: '90vw',
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Active Ports & Processes</h3>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                {ports.length} listening network port{ports.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchPorts}
              disabled={isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              title="Refresh ports"
            >
              {isLoading ? '...' : '↻'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div style={{
            margin: '12px 16px 0',
            padding: '8px 14px',
            backgroundColor: feedbackMsg.includes('Successfully') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedbackMsg.includes('Successfully') ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: feedbackMsg.includes('Successfully') ? '#4ade80' : '#f87171'
          }}>
            {feedbackMsg}
          </div>
        )}

        {/* Content List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {ports.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '13px' }}>
              {isLoading ? 'Scanning active ports...' : 'No active listening ports detected'}
            </div>
          ) : (
            ports.map(p => (
              <div 
                key={p.port}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '10px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '14px',
                      color: '#38bdf8',
                      fontFamily: 'monospace'
                    }}>
                      :{p.port}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      borderRadius: '4px'
                    }}>
                      {p.protocol}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    {p.processName} <span style={{ opacity: 0.5 }}>(PID {p.pid})</span>
                  </span>
                </div>

                <button
                  disabled={freeingPort === p.port}
                  onClick={() => handleFreePort(p.port)}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: freeingPort === p.port ? 'wait' : 'pointer',
                    transition: 'all 0.15s ease'
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
          padding: '12px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.45)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Kill zombie dev servers in 1-click</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
