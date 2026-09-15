import React, { useEffect, useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Server, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { OllamaProvider as OllamaModelManager, OllamaModel } from '../../ai/models/OllamaProvider';
import { EmbeddedModelManagerModal } from './EmbeddedModelManagerModal';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';

export interface AiSettingsPageProps {
  onClose?: () => void;
}

export const AiSettingsPage: React.FC<AiSettingsPageProps> = ({ onClose }) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [ollamaHealthy, setOllamaHealthy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [showEmbeddedModal, setShowEmbeddedModal] = useState(false);
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus | null>(null);
  const [autoStart, setAutoStart] = useState<boolean>(() => localStorage.getItem('sentinel_autostart_ai') !== 'false');
  const [engineActionLoading, setEngineActionLoading] = useState(false);
  
  const manager = new OllamaModelManager();

  useEffect(() => {
    checkHealthAndLoad();
    loadEmbeddedStatus();
  }, []);

  const loadEmbeddedStatus = async () => {
    const s = await EmbeddedEngineManager.getInstance().getStatus();
    setEmbeddedStatus(s);
  };

  const handleToggleEngine = async () => {
    setEngineActionLoading(true);
    try {
      if (embeddedStatus?.isRunning) {
        await EmbeddedEngineManager.getInstance().stopEngine();
      } else {
        await EmbeddedEngineManager.getInstance().startEngine();
      }
      await loadEmbeddedStatus();
      window.dispatchEvent(new CustomEvent('sentinel:ai-status-changed'));
    } catch (e) {
      console.error(e);
    }
    setEngineActionLoading(false);
  };

  const checkHealthAndLoad = async () => {
    setLoading(true);
    const isHealthy = await manager.checkHealth();
    setOllamaHealthy(isHealthy);
    if (isHealthy) {
      const ms = await manager.listModels();
      setModels(ms);
    }
    setLoading(false);
  };

  const handlePullModel = async (model: string) => {
    setPulling(true);
    setPullProgress('Starting download...');
    try {
      await manager.pullModel(model, (progress: any) => {
        if (progress.status) {
          setPullProgress(progress.status);
        }
      });
      await checkHealthAndLoad();
    } catch (e: any) {
      setPullProgress(`Error: ${e.message}`);
    }
    setPulling(false);
  };

  return (
    <div style={{
      padding: '32px 24px',
      color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: 'rgba(14, 16, 20, 0.98)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div style={{
        maxWidth: '840px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <Cpu size={16} />
            </div>
            <div>
              <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>
                AI Architecture & Providers
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)' }}>
                Local intelligence runtime, hardware acceleration, and inference endpoints
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
              }}
            >
              <span>Close Settings</span>
              <span style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.35)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '1px 5px',
                borderRadius: '4px'
              }}>
                ESC
              </span>
            </button>
          )}
        </div>

        {/* Embedded Native AI Card */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <Sparkles size={15} style={{ color: 'rgba(255, 255, 255, 0.65)' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                  Sentinel Embedded In-App AI
                </h2>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontWeight: 500
                }}>
                  Zero Ollama Required
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: 'rgba(255, 255, 255, 0.45)',
                  fontWeight: 500
                }}>
                  Recommended
                </span>
              </div>
              <p style={{ margin: '6px 0 16px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', lineHeight: 1.55, maxWidth: '620px' }}>
                Runs the industry-leading <strong style={{ color: '#ffffff', fontWeight: 500 }}>Qwen 2.5 Coder 3B Instruct</strong> model directly in-process with native hardware acceleration. No external software, terminal daemons, or background services required.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Status:</span>
                  <span style={{ 
                    color: embeddedStatus?.isRunning ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: embeddedStatus?.isRunning ? '#22c55e' : (embeddedStatus?.modelDownloaded ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.25)')
                    }} />
                    {embeddedStatus?.isRunning ? (embeddedStatus?.isCpuFallback ? 'Running (In-Process CPU)' : 'Running (In-Process GPU)') : (embeddedStatus?.modelDownloaded ? 'Stopped (Ready)' : 'Needs Model Download')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Model:</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500 }}>Qwen 2.5 Coder 3B (Q4_K_M ~1.9 GB)</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAutoStart(val);
                      localStorage.setItem('sentinel_autostart_ai', String(val));
                    }}
                    style={{ accentColor: '#ffffff', cursor: 'pointer' }}
                  />
                  <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Auto-start on launch</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {embeddedStatus?.modelDownloaded && (
                <button
                  onClick={handleToggleEngine}
                  disabled={engineActionLoading}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: embeddedStatus?.isRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: engineActionLoading ? 'not-allowed' : 'pointer',
                    opacity: engineActionLoading ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!engineActionLoading) {
                      e.currentTarget.style.backgroundColor = embeddedStatus?.isRunning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.18)';
                      e.currentTarget.style.borderColor = embeddedStatus?.isRunning ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.28)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = embeddedStatus?.isRunning ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  }}
                >
                  <span>
                    {engineActionLoading 
                      ? 'Please wait...' 
                      : (embeddedStatus?.isRunning ? 'Stop Engine' : 'Start Engine')}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowEmbeddedModal(true)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.13)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
                }}
              >
                <span>Configure Embedded Model</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* External Ollama Runtime (Optional Alternative) */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.025)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '20px 22px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <Server size={15} style={{ color: 'rgba(255, 255, 255, 0.55)' }} />
                <h2 style={{ fontSize: '15px', margin: 0, fontWeight: 600, color: '#ffffff' }}>
                  External Ollama Service (Alternative)
                </h2>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)' }}>
                Connect to a local or remote Ollama server (default: http://localhost:11434)
              </span>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.7)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              {ollamaHealthy ? <CheckCircle2 size={12} style={{ color: 'rgba(255, 255, 255, 0.75)' }} /> : <AlertCircle size={12} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />}
              <span>{ollamaHealthy ? 'Connected' : 'Not Running'}</span>
            </span>
          </div>

          {ollamaHealthy ? (
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Detected Ollama Models
              </h3>
              {models.length === 0 ? (
                <p style={{ opacity: 0.5, fontSize: '12px', margin: 0 }}>No models installed in Ollama.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {models.map(m => (
                    <div key={m.digest} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '13px', color: '#ffffff' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '2px' }}>
                          Size: {(m.size / 1e9).toFixed(2)} GB • Modified: {new Date(m.modified_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)', margin: 0, lineHeight: 1.55 }}>
              Ollama is not currently running. If you prefer using external Ollama over the built-in Embedded Engine, you can start it via <code style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(255, 255, 255, 0.8)' }}>ollama serve</code> in your terminal.
            </p>
          )}
        </div>
      </div>

      <EmbeddedModelManagerModal
        isOpen={showEmbeddedModal}
        onClose={() => {
          setShowEmbeddedModal(false);
          loadEmbeddedStatus();
        }}
      />
    </div>
  );
};
