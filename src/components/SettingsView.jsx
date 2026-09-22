import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Search, Database, Zap, Sliders, Server, Key, Check } from 'lucide-react';

export default function SettingsView({ config, onUpdateConfig }) {
  const [localConfig, setLocalConfig] = useState(() => ({
    defaultEngine: config?.defaultEngine || 'all',
    resultCount: config?.resultCount || 3,
    webllmModel: config?.webllmModel || import.meta.env.VITE_WEBLLM_MODEL || 'Phi-4-mini-instruct-q4f16_1-MLC',
    storeHistory: config?.storeHistory !== undefined ? config.storeHistory : true,
    telemetryEnabled: config?.telemetryEnabled !== undefined ? config.telemetryEnabled : true
  }));

  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const hasBingKey = !!import.meta.env.VITE_BING_API_KEY;
  const hasGoogleKeys = !!(import.meta.env.VITE_GOOGLE_API_KEY && import.meta.env.VITE_GOOGLE_CX);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        defaultEngine: config.defaultEngine || 'all',
        resultCount: config.resultCount || 3,
        webllmModel: config.webllmModel || import.meta.env.VITE_WEBLLM_MODEL || 'Phi-4-mini-instruct-q4f16_1-MLC',
        storeHistory: config.storeHistory !== undefined ? config.storeHistory : true,
        telemetryEnabled: config.telemetryEnabled !== undefined ? config.telemetryEnabled : true
      });
    }
  }, [config]);

  const handleChange = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdateConfig(localConfig);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
                  value={localConfig.defaultEngine}
                  onChange={(e) => handleChange('defaultEngine', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All (Google + Bing)</option>
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Default Result Count</label>
                <select
                  className="select"
                  value={localConfig.resultCount}
                  onChange={(e) => handleChange('resultCount', Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
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
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'block' }}>
                  Set keys in .env file. At least one engine key is required for search.
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
                  checked={localConfig.storeHistory}
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
                  checked={localConfig.telemetryEnabled}
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
              <Zap size={18} color="var(--primary-color)" /> AI Model Configuration
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>WebLLM Model</label>
                <input
                  type="text"
                  className="input"
                  value={localConfig.webllmModel}
                  onChange={(e) => handleChange('webllmModel', e.target.value)}
                  placeholder="Phi-4-mini-instruct-q4f16_1-MLC"
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Model downloaded to browser cache. Default: Phi-4-mini-instruct-q4f16_1-MLC
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
            {saveSuccess && (
              <span style={{ color: 'var(--success-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={16} /> Settings saved!
              </span>
            )}
            <button
              className="btn"
              disabled={!hasChanges}
              onClick={handleSave}
              style={{
                backgroundColor: hasChanges ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                color: hasChanges ? '#fff' : 'var(--text-muted)',
                cursor: hasChanges ? 'pointer' : 'not-allowed'
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
