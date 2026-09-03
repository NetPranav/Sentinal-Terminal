import React, { useEffect, useState } from 'react';
import { OllamaProvider as OllamaModelManager, OllamaModel } from '../../ai/models/OllamaProvider';
import { EmbeddedModelManagerModal } from './EmbeddedModelManagerModal';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';

export const AiSettingsPage: React.FC = () => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [ollamaHealthy, setOllamaHealthy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [showEmbeddedModal, setShowEmbeddedModal] = useState(false);
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus | null>(null);
  
  const manager = new OllamaModelManager();

  useEffect(() => {
    checkHealthAndLoad();
    loadEmbeddedStatus();
  }, []);

  const loadEmbeddedStatus = async () => {
    const s = await EmbeddedEngineManager.getInstance().getStatus();
    setEmbeddedStatus(s);
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
      padding: '32px',
      color: 'var(--sentinel-fg, #f8fafc)',
      fontFamily: 'var(--sentinel-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      height: '100%',
      overflow: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 600 }}>AI Architecture & Providers</h1>
      </div>

      {/* Embedded Native AI Card */}
      <div style={{
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '12px',
        padding: '22px',
        marginBottom: '28px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#38bdf8' }}>
                Sentinel Embedded In-App AI (Recommended)
              </h2>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontWeight: 600
              }}>
                Zero Ollama Required
              </span>
            </div>
            <p style={{ margin: '6px 0 14px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5, maxWidth: '640px' }}>
              Runs the industry-leading <strong>Qwen 2.5 Coder 3B Instruct</strong> model directly in-process with Apple Silicon Metal GPU acceleration. No external software, terminal daemons, or background services required.
            </p>

            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              <span>Status: <strong style={{ color: embeddedStatus?.isRunning ? '#4ade80' : '#eab308' }}>
                {embeddedStatus?.isRunning ? 'Running (Metal GPU)' : (embeddedStatus?.modelDownloaded ? 'Ready to launch' : 'Needs Model Download')}
              </strong></span>
              <span>Model: <strong>Qwen 2.5 Coder 3B (Q4_K_M ~1.9 GB)</strong></span>
            </div>
          </div>

          <button
            onClick={() => setShowEmbeddedModal(true)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#38bdf8',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(56, 189, 248, 0.3)',
              flexShrink: 0
            }}
          >
            Configure Embedded Model →
          </button>
        </div>
      </div>

      {/* External Ollama Runtime (Optional Alternative) */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '22px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '17px', margin: 0, fontWeight: 600 }}>External Ollama Service (Alternative)</h2>
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Connect to a local or remote Ollama server (default: http://localhost:11434)
            </span>
          </div>
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: ollamaHealthy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: ollamaHealthy ? '#4ade80' : 'rgba(255, 255, 255, 0.4)'
          }}>
            {ollamaHealthy ? 'Connected ✓' : 'Not Running'}
          </span>
        </div>

        {ollamaHealthy ? (
          <div>
            <h3 style={{ fontSize: '14px', marginBottom: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>
              Detected Ollama Models
            </h3>
            {models.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: '13px' }}>No models installed in Ollama.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {models.map(m => (
                  <div key={m.digest} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{m.name}</div>
                      <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>
                        Size: {(m.size / 1e9).toFixed(2)} GB • Modified: {new Date(m.modified_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', margin: 0 }}>
            Ollama is not currently running. If you prefer using external Ollama over the built-in Embedded Engine, you can start it via <code>ollama serve</code> in your terminal.
          </p>
        )}
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
