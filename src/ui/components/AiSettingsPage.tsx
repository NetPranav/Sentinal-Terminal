import React, { useEffect, useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Server, 
  CheckCircle2, 
  AlertCircle,
  Key,
  Globe,
  Download,
  Check,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import { OllamaProvider as OllamaModelManager, OllamaModel } from '../../ai/models/OllamaProvider';
import { EmbeddedModelManagerModal } from './EmbeddedModelManagerModal';
import { EmbeddedEngineManager, EmbeddedStatus } from '../../ai/models/EmbeddedEngineManager';
import { ModelRecommendationEngine, TierRecommendationResult } from '../../ai/management/ModelRecommendationEngine';
import { CloudApiProvider, CloudServiceId, CloudKeyConfig, CLOUD_CATALOG } from '../../ai/provider/CloudApiProvider';

export interface AiSettingsPageProps {
  onClose?: () => void;
}

export const AiSettingsPage: React.FC<AiSettingsPageProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [ollamaHealthy, setOllamaHealthy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [showEmbeddedModal, setShowEmbeddedModal] = useState(false);
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus | null>(null);
  const [autoStart, setAutoStart] = useState<boolean>(() => localStorage.getItem('sentinel_autostart_ai') !== 'false');
  const [engineActionLoading, setEngineActionLoading] = useState(false);

  // Recommendation Engine State
  const [recommendation, setRecommendation] = useState<TierRecommendationResult | null>(null);

  // Cloud API Key State
  const [cloudConfigs, setCloudConfigs] = useState<Record<CloudServiceId, CloudKeyConfig>>(() => CloudApiProvider.getInstance().getSavedConfigs());
  const [selectedCloudService, setSelectedCloudService] = useState<CloudServiceId>('groq');
  const [keyInput, setKeyInput] = useState<string>('');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  
  const manager = new OllamaModelManager();
  const cloudProvider = CloudApiProvider.getInstance();

  useEffect(() => {
    checkHealthAndLoad();
    loadEmbeddedStatus();
    loadRecommendations();
    loadCloudConfigState(selectedCloudService);
  }, []);

  const loadRecommendations = () => {
    const rec = ModelRecommendationEngine.getInstance().getRecommendation();
    setRecommendation(rec);
  };

  const loadCloudConfigState = (serviceId: CloudServiceId) => {
    const configs = cloudProvider.getSavedConfigs();
    setCloudConfigs(configs);
    const cfg = configs[serviceId];
    if (cfg) {
      setKeyInput(cfg.apiKey || '');
      setCustomUrlInput(cfg.baseUrl || CLOUD_CATALOG[serviceId].defaultUrl);
      setCustomModelInput(cfg.modelId || CLOUD_CATALOG[serviceId].defaultModel);
    }
    setTestResult(null);
    setSaveSuccessMsg(null);
  };

  const handleSelectCloudService = (serviceId: CloudServiceId) => {
    setSelectedCloudService(serviceId);
    loadCloudConfigState(serviceId);
  };

  const handleTestConnection = async () => {
    if (!keyInput.trim()) {
      setTestResult({ success: false, error: 'Please enter an API key first.' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await cloudProvider.testConnection(
        selectedCloudService,
        keyInput.trim(),
        customUrlInput.trim() || undefined,
        customModelInput.trim() || undefined
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Connection test failed' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveCloudConfig = (setAsActive = true) => {
    const current = cloudConfigs[selectedCloudService];
    const updated: CloudKeyConfig = {
      ...current,
      serviceId: selectedCloudService,
      apiKey: keyInput.trim(),
      baseUrl: customUrlInput.trim() || undefined,
      modelId: customModelInput.trim() || undefined,
      isActive: setAsActive
    };

    // If setting active, deactivate other cloud keys
    if (setAsActive) {
      const all = cloudProvider.getSavedConfigs();
      for (const k of Object.keys(all) as CloudServiceId[]) {
        all[k].isActive = false;
      }
      all[selectedCloudService] = updated;
      cloudProvider.saveConfig(updated);
      setCloudConfigs(all);
    } else {
      cloudProvider.saveConfig(updated);
      setCloudConfigs(cloudProvider.getSavedConfigs());
    }

    setSaveSuccessMsg(`✓ ${CLOUD_CATALOG[selectedCloudService].name} configuration saved${setAsActive ? ' & activated' : ''}!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
    window.dispatchEvent(new CustomEvent('sentinel:ai-status-changed'));
  };

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
      padding: '28px 24px',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      height: '100%',
      overflowY: 'auto',
      backgroundColor: 'rgba(14, 16, 20, 0.98)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div style={{
        maxWidth: '860px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.9)'
            }}>
              <Cpu size={16} />
            </div>
            <div>
              <h1 style={{ fontSize: '16px', margin: 0, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.2px' }}>
                AI Architecture & Model Management
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.55)' }}>
                Hardware-tiered local models, embedded engines, and cloud API endpoints
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
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
            >
              <span>Close Settings</span>
              <span style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '1px 5px',
                borderRadius: '4px'
              }}>
                ESC
              </span>
            </button>
          )}
        </div>

        {/* Navigation Tabs (Grayscale Token Style) */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
          <button
            onClick={() => setActiveTab('local')}
            style={{
              padding: '7px 16px',
              borderRadius: '7px',
              border: activeTab === 'local' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
              backgroundColor: activeTab === 'local' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: activeTab === 'local' ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Cpu size={14} />
            <span>Local Engine & Hardware Tiers</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            style={{
              padding: '7px 16px',
              borderRadius: '7px',
              border: activeTab === 'cloud' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
              backgroundColor: activeTab === 'cloud' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              color: activeTab === 'cloud' ? '#ffffff' : 'rgba(255, 255, 255, 0.55)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Key size={14} />
            <span>Cloud API Keys & External Providers</span>
            {cloudProvider.getActiveConfig() && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ffffff'
              }} />
            )}
          </button>
        </div>

        {/* TAB 1: LOCAL HARDWARE & LOCAL MODELS */}
        {activeTab === 'local' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* System Hardware & Recommendation Card */}
            {recommendation && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={15} color="#ffffff" />
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#ffffff' }}>
                      System Hardware Profile: {recommendation.detectedRamGb}GB RAM · {recommendation.detectedCores} CPU Cores
                    </span>
                    {recommendation.gpuSummary && (
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        color: 'rgba(255, 255, 255, 0.9)'
                      }}>
                        {recommendation.gpuSummary}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff'
                  }}>
                    {recommendation.tierLabel}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
                  {recommendation.summaryRationale}
                </p>

                {/* Recommended models for this tier */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.55)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recommended Models for Your System:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                    {recommendation.recommendedModels.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.025)',
                          border: m.isDefault ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#ffffff' }}>
                            {m.name}
                          </span>
                          {m.isDefault && (
                            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff' }}>
                              Optimal
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          RAM needed: ~{m.ramRequiredGb}GB · {m.parameterCount} ({m.quantization})
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.35 }}>
                          {m.bestFor}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                          <button
                            onClick={() => handlePullModel(m.id)}
                            disabled={pulling}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '5px',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: pulling ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Download size={11} />
                            <span>Download ({m.parameterCount})</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Embedded Native AI Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <Sparkles size={15} style={{ color: '#ffffff' }} />
                    <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600, color: '#ffffff' }}>
                      Sentinel Embedded In-Process AI Engine
                    </h2>
                    <span style={{
                      fontSize: '10.5px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: 'rgba(255, 255, 255, 0.85)'
                    }}>
                      Standalone Native Sidecar
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 14px', fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
                    Runs local models in-process without external daemons. Fully private, zero cloud data transfer.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '18px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Status:</span>
                      <span style={{ color: '#ffffff', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: embeddedStatus?.isRunning ? '#22c55e' : 'rgba(255, 255, 255, 0.3)'
                        }} />
                        {embeddedStatus?.isRunning ? (embeddedStatus?.isCpuFallback ? 'Running (CPU)' : 'Running (GPU)') : (embeddedStatus?.modelDownloaded ? 'Ready (Stopped)' : 'Download Required')}
                      </span>
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
                      <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Auto-start on boot</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {embeddedStatus?.modelDownloaded && (
                    <button
                      onClick={handleToggleEngine}
                      disabled={engineActionLoading}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: engineActionLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {engineActionLoading ? 'Wait...' : (embeddedStatus?.isRunning ? 'Stop Engine' : 'Start Engine')}
                    </button>
                  )}

                  <button
                    onClick={() => setShowEmbeddedModal(true)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Manage Engine Models
                  </button>
                </div>
              </div>
            </div>

            {/* External Ollama Server Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '18px 20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={15} style={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                    External Ollama Daemon (http://localhost:11434)
                  </h3>
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: ollamaHealthy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                  color: ollamaHealthy ? '#4ade80' : 'rgba(255, 255, 255, 0.5)',
                  border: `1px solid ${ollamaHealthy ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                }}>
                  {ollamaHealthy ? '● Online' : '○ Offline'}
                </span>
              </div>

              {pullProgress && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', fontSize: '12px', color: '#ffffff', marginBottom: '10px' }}>
                  {pullProgress}
                </div>
              )}

              {models.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {models.map(m => (
                    <span key={m.name} style={{ padding: '3px 8px', borderRadius: '5px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '11.5px', color: '#ffffff' }}>
                      {m.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)' }}>
                  {ollamaHealthy ? 'No models installed in external Ollama.' : 'External Ollama is not running. Sentinel will use the embedded engine or configured cloud API keys.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CLOUD API KEYS & EXTERNAL PROVIDERS */}
        {activeTab === 'cloud' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Explanatory Header */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={15} color="#ffffff" />
                <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#ffffff' }}>
                  Cloud Model Providers (Zero Local Resource Footprint)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
                Offload LLM inference to high-speed cloud providers (OpenAI, Anthropic, Groq, DeepSeek). Local CPU and RAM usage drop to 0% during command reasoning.
              </p>
            </div>

            {/* Provider Selector Strip */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(Object.keys(CLOUD_CATALOG) as CloudServiceId[]).map((serviceId) => {
                const isSel = selectedCloudService === serviceId;
                const isAct = cloudConfigs[serviceId]?.isActive;
                return (
                  <button
                    key={serviceId}
                    onClick={() => handleSelectCloudService(serviceId)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '7px',
                      border: isSel ? '1px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: isSel ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.025)',
                      color: isSel ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{CLOUD_CATALOG[serviceId].name}</span>
                    {isAct && (
                      <span style={{
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: '#ffffff',
                        color: '#0a0a0c',
                        fontSize: '9px',
                        fontWeight: 700
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Provider Form */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>
                  {CLOUD_CATALOG[selectedCloudService].name} Configuration
                </span>
                {cloudConfigs[selectedCloudService]?.isActive && (
                  <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    Currently Active AI Engine
                  </span>
                )}
              </div>

              {/* API Key Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
                  API Key:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={`Enter ${CLOUD_CATALOG[selectedCloudService].name} API Key...`}
                      style={{
                        width: '100%',
                        padding: '8px 36px 8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        outline: 'none',
                        fontFamily: 'ui-monospace, monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom URL and Model inputs for Custom/Advanced */}
              {selectedCloudService === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
                      Endpoint Base URL:
                    </label>
                    <input
                      type="text"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="http://localhost:8000/v1/chat/completions"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        color: '#ffffff',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
                      Model Identifier:
                    </label>
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="e.g. meta-llama/Llama-3-70b-chat"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        color: '#ffffff',
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Feedback messages */}
              {testResult && (
                <div style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  backgroundColor: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${testResult.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: testResult.success ? '#86efac' : '#fca5a5',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>
                    {testResult.success ? `✓ Connection verified successfully (${testResult.latencyMs}ms latency)` : `Error: ${testResult.error}`}
                  </span>
                </div>
              )}

              {saveSuccessMsg && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', fontSize: '12px' }}>
                  {saveSuccessMsg}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !keyInput.trim()}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: (testingConnection || !keyInput.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (testingConnection || !keyInput.trim()) ? 0.5 : 1
                  }}
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveCloudConfig(true)}
                  disabled={!keyInput.trim()}
                  style={{
                    padding: '7px 18px',
                    borderRadius: '6px',
                    border: '1px solid #ffffff',
                    backgroundColor: '#ffffff',
                    color: '#0a0a0c',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: !keyInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: !keyInput.trim() ? 0.5 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Check size={13} />
                  <span>Save & Activate Provider</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {showEmbeddedModal && (
        <EmbeddedModelManagerModal
          isOpen={showEmbeddedModal}
          onClose={() => {
            setShowEmbeddedModal(false);
            loadEmbeddedStatus();
          }}
        />
      )}
    </div>
  );
};
