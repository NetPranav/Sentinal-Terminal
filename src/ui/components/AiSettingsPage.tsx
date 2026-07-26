import React, { useEffect, useState } from 'react';
import { OllamaProvider as OllamaModelManager, OllamaModel } from '../../ai/models/OllamaProvider';

export const AiSettingsPage: React.FC = () => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [ollamaHealthy, setOllamaHealthy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  
  const manager = new OllamaModelManager();

  useEffect(() => {
    checkHealthAndLoad();
  }, []);

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
      color: 'var(--sentinel-fg)',
      fontFamily: 'var(--sentinel-font)',
      height: '100%',
      overflow: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(20px)',
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px', fontWeight: 600 }}>AI Settings</h1>
      
      {!loading && !ollamaHealthy && (
        <div style={{
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          border: '1px solid var(--sentinel-red)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          <h2 style={{ color: 'var(--sentinel-red)', marginTop: 0 }}>Ollama is not running</h2>
          <p>Sentinel Terminal requires Ollama for local AI planning. Please install Ollama from <a href="https://ollama.com" target="_blank" style={{color: 'var(--sentinel-blue)'}}>ollama.com</a> and start it.</p>
        </div>
      )}

      {ollamaHealthy && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '16px', color: 'var(--sentinel-blue)' }}>Installed Models</h2>
          
          {models.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No models installed.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {models.map(m => (
                <div key={m.digest} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '15px' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                      Size: {(m.size / 1e9).toFixed(2)} GB • Modified: {new Date(m.modified_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    color: 'var(--sentinel-red)',
                    border: '1px solid rgba(255, 0, 0, 0.2)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ollamaHealthy && (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px',
          borderRadius: '12px'
        }}>
          <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '16px', color: 'var(--sentinel-cyan)' }}>Download Models</h2>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              type="text" 
              defaultValue="qwen:4b" 
              id="modelInput"
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: 'white',
                fontFamily: 'inherit'
              }}
            />
            <button 
              disabled={pulling}
              onClick={() => handlePullModel((document.getElementById('modelInput') as HTMLInputElement).value)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--sentinel-blue)',
                color: 'black',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: pulling ? 'not-allowed' : 'pointer',
                opacity: pulling ? 0.7 : 1
              }}
            >
              {pulling ? 'Pulling...' : 'Pull Model'}
            </button>
          </div>
          
          {pullProgress && (
            <div style={{ marginTop: '16px', fontSize: '13px', opacity: 0.8, color: 'var(--sentinel-magenta)' }}>
              {pullProgress}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
