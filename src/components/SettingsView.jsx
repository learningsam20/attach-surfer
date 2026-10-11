import { useState, useEffect } from 'react';
import { Cpu, Search, Database, Zap, Check, RotateCcw } from 'lucide-react';

export function getCleanConfig(cfg = {}) {
  return {
    defaultEngine: cfg?.defaultEngine || 'all',
    defaultAttachmentFilter: cfg?.defaultAttachmentFilter || 'with',
    resultCount: Number(cfg?.resultCount) || 3,
    brightDataApiKey: cfg?.brightDataApiKey || '',
    brightDataZone: cfg?.brightDataZone || 'serp_api1',
    googleApiKey: cfg?.googleApiKey || '',
    googleCx: cfg?.googleCx || '',
    bingApiKey: cfg?.bingApiKey || '',
    aiModel: cfg?.aiModel || 'phi4',
    embeddingModel: cfg?.embeddingModel || 'embeddinggemma2',
    aiBackend: cfg?.aiBackend || 'auto',
    webllmModel: cfg?.webllmModel || 'Phi-4-mini-instruct-q4f16_1-MLC',
    gemmaModel: cfg?.gemmaModel || 'gemma-4-E2B-it-web',
    localModelsPath: cfg?.localModelsPath || '/models',
    storeHistory: cfg?.storeHistory !== undefined ? Boolean(cfg.storeHistory) : true,
    telemetryEnabled: cfg?.telemetryEnabled !== undefined ? Boolean(cfg.telemetryEnabled) : true
  };
}

export default function SettingsView({ config, onUpdateConfig }) {
  const [localConfig, setLocalConfig] = useState(() => getCleanConfig(config));
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isValidApiKey = (key) => {
    if (!key) return false;
    const trimmed = String(key).trim();
    return !!trimmed && trimmed !== 'YOUR_BING_KEY_HERE' && !(trimmed.startsWith('YOUR_') && trimmed.endsWith('_HERE'));
  };

  const hasBingKey = isValidApiKey(localConfig.bingApiKey || import.meta.env.VITE_BING_API_KEY);
  const hasGoogleKeys = isValidApiKey(localConfig.googleApiKey || import.meta.env.VITE_GOOGLE_API_KEY) && !!(localConfig.googleCx || import.meta.env.VITE_GOOGLE_CX);
  const hasBrightDataKey = isValidApiKey(localConfig.brightDataApiKey || import.meta.env.VITE_BRIGHTDATA_API_KEY);

  useEffect(() => {
    if (config && !hasChanges) {
      setLocalConfig(getCleanConfig(config));
    }
  }, [config, hasChanges]);

  const handleChange = (key, value) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value !== undefined && value !== null ? value : ''
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateConfig(localConfig);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = async () => {
    try {
      const res = await fetch('/config.json');
      if (res.ok) {
        const defaults = await res.json();
        setLocalConfig({
          defaultEngine: defaults.defaultEngine || 'all',
          resultCount: defaults.resultCount || 3,
          brightDataApiKey: defaults.brightDataApiKey || '',
          brightDataZone: defaults.brightDataZone || 'serp_api1',
          googleApiKey: '',
          googleCx: '',
          bingApiKey: '',
          aiModel: defaults.aiModel || 'phi4',
          embeddingModel: defaults.embeddingModel || 'embeddinggemma2',
          aiBackend: defaults.aiBackend || 'auto',
          webllmModel: defaults.webllmModel || 'Phi-4-mini-instruct-q4f16_1-MLC',
          gemmaModel: defaults.gemmaModel || 'gemma-4-E2B-it-web',
          localModelsPath: defaults.localModelsPath || '/models',
          defaultAttachmentFilter: defaults.defaultAttachmentFilter || 'with',
          storeHistory: defaults.storeHistory !== undefined ? defaults.storeHistory : true,
          telemetryEnabled: defaults.telemetryEnabled !== undefined ? defaults.telemetryEnabled : true
        });
        setHasChanges(true);
        return;
      }
    } catch {
      // fallback below
    }

    setLocalConfig({
      defaultEngine: 'all',
      defaultAttachmentFilter: 'with',
      resultCount: 3,
      brightDataApiKey: '',
      brightDataZone: 'serp_api1',
      googleApiKey: '',
      googleCx: '',
      bingApiKey: '',
      aiModel: 'phi4',
      embeddingModel: 'embeddinggemma2',
      aiBackend: 'auto',
      webllmModel: 'Phi-4-mini-instruct-q4f16_1-MLC',
      gemmaModel: 'gemma-4-E2B-it-web',
      localModelsPath: '/models',
      storeHistory: true,
      telemetryEnabled: true
    });
    setHasChanges(true);
  };

  const hardware = {
    cores: navigator.hardwareConcurrency || 'Unknown',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
    gpu: 'WebGPU (Chrome/Edge preferred)'
  };

  return (
    <div className="settings-container">
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Configure search behavior, AI model, and data storage preferences.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={18} color="var(--primary-color)" /> Search Configuration
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Default Engine</label>
                <select
                  className="select"
                  value={localConfig.defaultEngine || 'all'}
                  onChange={(e) => handleChange('defaultEngine', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All (Google + Bing + BrightData)</option>
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="brightdata">Bright Data</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Default Result Count</label>
                <select
                  className="select"
                  value={localConfig.resultCount ?? 3}
                  onChange={(e) => handleChange('resultCount', Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Default Attachment Filter</label>
                <select
                  className="select"
                  value={localConfig.defaultAttachmentFilter || 'all'}
                  onChange={(e) => handleChange('defaultAttachmentFilter', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">Don't filter (All content)</option>
                  <option value="with">With attachments only (.pdf, .docx, .xlsx, etc.)</option>
                  <option value="without">Without attachments (Web pages only)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Choose whether new searches default to web pages with downloadable file attachments.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Bright Data API Key</label>
                <input
                  type="password"
                  className="input"
                  value={localConfig.brightDataApiKey || ''}
                  onChange={(e) => handleChange('brightDataApiKey', e.target.value)}
                  placeholder="Enter Bright Data API Key"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Bright Data Zone</label>
                <input
                  type="text"
                  className="input"
                  value={localConfig.brightDataZone || ''}
                  onChange={(e) => handleChange('brightDataZone', e.target.value)}
                  placeholder="serp_api1"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  SERP API zone name from your Bright Data dashboard (default: serp_api1)
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Google API Key</label>
                <input
                  type="password"
                  className="input"
                  value={localConfig.googleApiKey || ''}
                  onChange={(e) => handleChange('googleApiKey', e.target.value)}
                  placeholder="Enter Google Custom Search API Key"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Google Search Engine ID (CX)</label>
                <input
                  type="text"
                  className="input"
                  value={localConfig.googleCx || ''}
                  onChange={(e) => handleChange('googleCx', e.target.value)}
                  placeholder="Enter Google Search Engine ID (CX)"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Bing API Key</label>
                <input
                  type="password"
                  className="input"
                  value={localConfig.bingApiKey || ''}
                  onChange={(e) => handleChange('bingApiKey', e.target.value)}
                  placeholder="Enter Bing Web Search API Key"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>API Key Status</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: hasBingKey ? 'var(--success-color)' : 'var(--danger-color)' }} />
                    <span>Bing API {hasBingKey ? '(configured)' : '(not set)'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: hasGoogleKeys ? 'var(--success-color)' : 'var(--danger-color)' }} />
                    <span>Google API {hasGoogleKeys ? '(configured)' : '(not set)'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: hasBrightDataKey ? 'var(--success-color)' : 'var(--danger-color)' }} />
                    <span>Bright Data API {hasBrightDataKey ? '(configured)' : '(not set)'}</span>
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Configure keys in .env file or save above. At least one engine key is required for search.
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="var(--primary-color)" /> Data & Privacy
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(localConfig.storeHistory)}
                  onChange={(e) => handleChange('storeHistory', e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>Store Search History</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Save searches in IndexedDB for later review</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(localConfig.telemetryEnabled)}
                  onChange={(e) => handleChange('telemetryEnabled', e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '500' }}>Enable Telemetry</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Track usage events locally (never leaves your browser)</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--primary-color)" /> In-Browser AI Models
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>AI Text Model</label>
                <select
                  className="input"
                  value={localConfig.aiModel || 'phi4'}
                  onChange={(e) => handleChange('aiModel', e.target.value)}
                >
                  <option value="phi4">Phi-4 Mini (WebLLM - WebGPU)</option>
                  <option value="gemma4">Gemma-4 (LiteRT-LM / Transformers.js)</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Execution occurs 100% locally in browser memory (no backend required).
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Embedding Model</label>
                <select
                  className="input"
                  value={localConfig.embeddingModel || 'embeddinggemma2'}
                  onChange={(e) => handleChange('embeddingModel', e.target.value)}
                >
                  <option value="embeddinggemma2">EmbeddingGemma-2 (768-dim, In-Browser)</option>
                  <option value="hash">Local Deterministic Word Hash (128-dim)</option>
                </select>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Powers semantic clustering and similarity in client-side RxDB.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>AI Backend</label>
                <select
                  className="input"
                  value={localConfig.aiBackend || 'auto'}
                  onChange={(e) => handleChange('aiBackend', e.target.value)}
                >
                  <option value="auto">Auto (LiteRT-LM / Transformers.js / WebLLM)</option>
                  <option value="litert-lm">LiteRT-LM (Google LiteRT Web)</option>
                  <option value="transformers">Transformers.js (HuggingFace WebGPU/WASM)</option>
                  <option value="webllm">WebLLM (Apache TVM WebGPU)</option>
                </select>
              </div>

              {localConfig.aiModel === 'phi4' ? (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>WebLLM Model ID</label>
                  <input
                    type="text"
                    className="input"
                    value={localConfig.webllmModel || ''}
                    onChange={(e) => handleChange('webllmModel', e.target.value)}
                    placeholder="Phi-4-mini-instruct-q4f16_1-MLC"
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Model downloaded to browser cache. Default: Phi-4-mini-instruct-q4f16_1-MLC
                  </span>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Gemma-4 Model ID</label>
                  <input
                    type="text"
                    className="input"
                    value={localConfig.gemmaModel || ''}
                    onChange={(e) => handleChange('gemmaModel', e.target.value)}
                    placeholder="gemma-4-E2B-it-web"
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Model downloaded to browser cache. Default: gemma-4-E2B-it-web
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Local Model Serving Path</label>
                <input
                  type="text"
                  className="input"
                  value={localConfig.localModelsPath || ''}
                  onChange={(e) => handleChange('localModelsPath', e.target.value)}
                  placeholder="/models"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Relative URL served by Vite/web server where downloaded models are loaded from (default: <code>/models</code>).
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color="var(--primary-color)" /> Hardware Specs
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Cores</span>
                <span style={{ fontWeight: '600' }}>{hardware.cores}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>RAM</span>
                <span style={{ fontWeight: '600' }}>{hardware.memory}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Acceleration</span>
                <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{hardware.gpu}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {saveSuccess && (
              <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: 'auto' }}>
                <Check size={16} /> Settings saved!
              </span>
            )}
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleResetDefaults}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCcw size={14} /> Reset to Defaults
            </button>
            <button
              type="button"
              className="btn"
              disabled={!hasChanges}
              onClick={handleSave}
              style={{
                backgroundColor: hasChanges ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                color: hasChanges ? '#fff' : 'var(--text-muted)',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem'
              }}
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
