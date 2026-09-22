import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Settings, Clock, Sun, Moon, ChevronLeft, ChevronRight,
  Loader2, Sparkles, Compass, Zap
} from 'lucide-react';
import { checkHardwareCapabilities } from './utils/hardwareCheck';
import { search, filterByAttachment } from './services/searchService';
import { extractPageContent } from './services/extractService';
import { generateSummary } from './services/summaryService';
import { trackEvent } from './services/telemetryService';
import { db } from './db/database';
import HardwareWarning from './components/HardwareWarning';
import SearchBar from './components/SearchBar';
import ResultCard from './components/ResultCard';
import SummaryPanel from './components/SummaryPanel';
import SettingsView from './components/SettingsView';
import SearchHistory from './components/SearchHistory';

const VERSION = '1.0.0';

export default function App() {
  const [config, setConfig] = useState(null);
  const [hardwareWarnings, setHardwareWarnings] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [contents, setContents] = useState({});
  const [expandedUrls, setExpandedUrls] = useState(new Set());
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(defaultData => {
        const saved = localStorage.getItem('attachSurferConfig');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.version === defaultData.version) {
            setConfig(parsed);
            return;
          }
        }
        setConfig(defaultData);
        localStorage.setItem('attachSurferConfig', JSON.stringify(defaultData));
      })
      .catch(() => {
        const saved = localStorage.getItem('attachSurferConfig');
        if (saved) setConfig(JSON.parse(saved));
      });
  }, []);

  useEffect(() => {
    if (config) {
      const { warnings } = checkHardwareCapabilities();
      setHardwareWarnings(warnings);
    }
  }, [config]);

  const updateConfig = (newConfig) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('attachSurferConfig', JSON.stringify(updated));
  };

  const handleSearch = useCallback(async ({ query, engine, attachmentFilter, resultCount }) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setContents({});
    setExpandedUrls(new Set());
    setSummary(null);
    setSummaryError(null);
    setSearchProgress('Searching the web...');

    trackEvent('search', { query, engine, resultCount });

    try {
      const selectedEngine = engine || config?.defaultEngine || 'all';
      const count = resultCount || config?.resultCount || 3;

      const hasBing = !!import.meta.env.VITE_BING_API_KEY;
      const hasGoogle = !!(import.meta.env.VITE_GOOGLE_API_KEY && import.meta.env.VITE_GOOGLE_CX);

      if (!hasBing && !hasGoogle) {
        setSearchProgress('');
        setSummaryError('No search API keys configured. Add VITE_BING_API_KEY or VITE_GOOGLE_API_KEY + VITE_GOOGLE_CX to your .env file.');
        setIsSearching(false);
        return;
      }

      if (selectedEngine === 'google' && !hasGoogle) {
        setSearchProgress('');
        setSummaryError('Google API key not configured. Add VITE_GOOGLE_API_KEY and VITE_GOOGLE_CX to .env, or switch to Bing.');
        setIsSearching(false);
        return;
      }

      if (selectedEngine === 'bing' && !hasBing) {
        setSearchProgress('');
        setSummaryError('Bing API key not configured. Add VITE_BING_API_KEY to .env, or switch to Google.');
        setIsSearching(false);
        return;
      }

      let results = await search(query, selectedEngine, count);

      if (attachmentFilter !== 'all') {
        results = filterByAttachment(results, attachmentFilter);
      }

      setSearchResults(results);

      const searchId = await db.searches.add({
        query,
        engine: selectedEngine,
        resultCount: count,
        attachmentFilter,
        timestamp: Date.now(),
        resultIds: []
      });

      const resultIds = [];
      for (const r of results) {
        const id = await db.results.add({
          searchId,
          rank: r.rank,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          engine: r.engine,
          timestamp: Date.now()
        });
        resultIds.push(id);
      }

      await db.searches.update(searchId, { resultIds });
      setHistoryRefreshKey(k => k + 1);

      setSearchProgress('Extracting content from pages...');

      const contentPromises = results.map(r => extractPageContent(r.url));
      const contentResults = await Promise.allSettled(contentPromises);

      const newContents = {};
      contentResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          newContents[results[i].url] = result.value;
        } else {
          newContents[results[i].url] = {
            url: results[i].url,
            type: 'error',
            markdown: 'Failed to extract content',
            success: false
          };
        }
      });

      setContents(newContents);
      setSearchProgress('');

      for (const r of results) {
        if (newContents[r.url]) {
          await db.attachments.add({
            resultId: null,
            searchId,
            filename: r.url.split('/').pop(),
            type: newContents[r.url].type,
            content: newContents[r.url].markdown,
            timestamp: Date.now()
          });
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchProgress(`Search failed: ${err.message}`);
      trackEvent('search_error', { query, error: err.message });
    } finally {
      setIsSearching(false);
    }
  }, [config]);

  const handleToggleContent = useCallback((url) => {
    setExpandedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
        if (!contents[url]) {
          extractPageContent(url).then(content => {
            setContents(prev => ({ ...prev, [url]: content }));
          });
        }
      }
      return next;
    });
  }, [contents]);

  const handleGenerateSummary = useCallback(async () => {
    if (searchResults.length === 0) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);
    trackEvent('summary_generate', { resultCount: searchResults.length });

    try {
      const result = await generateSummary(searchResults, contents, (progress) => {
        setSearchProgress(progress);
      });
      setSummary(result);

      const searchRecord = await db.searches.orderBy('timestamp').last();
      if (searchRecord) {
        await db.summaries.add({
          searchId: searchRecord.id,
          content: result,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Summary generation failed:', err);
      setSummaryError(err.message);
    } finally {
      setIsGeneratingSummary(false);
      setSearchProgress('');
    }
  }, [searchResults, contents]);

  const handleSelectHistory = useCallback((search) => {
    setActiveTab('search');
    handleSearch({
      query: search.query,
      engine: search.engine,
      attachmentFilter: 'all',
      resultCount: search.resultCount
    });
  }, [handleSearch]);

  const menuItems = [
    { id: 'search', label: 'Search', icon: <Search size={18} /> },
    { id: 'history', label: 'History', icon: <Clock size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  if (!config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} className="spinner" style={{ marginBottom: '1rem' }} />
          <p>Loading AttachSurfer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar">
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-btn"
          title={sidebarCollapsed ? 'Expand Menu' : 'Collapse Menu'}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="logo-section" style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: sidebarCollapsed ? 0 : '0.75rem' }}>
          <div className="logo-icon">
            <Compass size={22} color="var(--primary-color)" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(to right, var(--text-main), var(--primary-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                AttachSurfer
              </h1>
              <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Smart Search
              </p>
            </div>
          )}
        </div>

        <ul style={{ listStyle: 'none', marginTop: '1rem', flex: 1, padding: 0 }}>
          {menuItems.map(item => (
            <li key={item.id} style={{ marginBottom: '0.5rem' }}>
              <button
                className="btn"
                title={sidebarCollapsed ? item.label : ''}
                style={{
                  width: '100%',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  backgroundColor: activeTab === item.id ? 'var(--primary-color)' : 'transparent',
                  color: activeTab === item.id ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  padding: sidebarCollapsed ? '0.6rem 0' : '0.6rem 1rem',
                  gap: sidebarCollapsed ? '0' : '0.75rem'
                }}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon}
                {!sidebarCollapsed && <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: '500' }}>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1rem',
          display: 'flex',
          flexDirection: sidebarCollapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <button
            className="btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            style={{
              padding: '0.6rem',
              color: 'var(--text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: sidebarCollapsed ? '100%' : 'auto'
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <main className="main-content">
        <HardwareWarning warnings={hardwareWarnings} />

        <header className="header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
            {menuItems.find(i => i.id === activeTab)?.label || 'Settings'}
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {searchResults.length > 0 && (
              <span>{searchResults.length} results</span>
            )}
            <span>v{VERSION}</span>
          </div>
        </header>

        <div className="content-area">
          {searchProgress && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(129, 140, 248, 0.1) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius)',
              padding: '0.75rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)'
            }}>
              <Loader2 size={16} className="spinner" />
              {searchProgress}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="animate-fade-in">
              <SearchBar onSearch={handleSearch} isSearching={isSearching} />

              {searchResults.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Search Results ({searchResults.length})
                    </h3>
                    <button
                      className="btn"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {isGeneratingSummary ? (
                        <><Loader2 size={14} className="spinner" /> Generating...</>
                      ) : (
                        <><Sparkles size={14} /> Generate Summary</>
                      )}
                    </button>
                  </div>

                  <div className="result-list">
                    {searchResults.map((result, i) => (
                      <ResultCard
                        key={`${result.url}-${i}`}
                        result={result}
                        index={i}
                        content={contents[result.url]}
                        onToggleContent={handleToggleContent}
                        isExpanded={expandedUrls.has(result.url)}
                      />
                    ))}
                  </div>

                  <SummaryPanel
                    summary={summary}
                    isGenerating={isGeneratingSummary}
                    error={summaryError}
                  />
                </div>
              )}

              {searchResults.length === 0 && !isSearching && (
                <div className="stats-grid" style={{ marginTop: '2rem' }}>
                  <div className="stat-card">
                    <span className="stat-label">Privacy</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--success-color)' }}>100%</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All processing in-browser</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">AI Engine</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>WebLLM</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No server required</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Engines</span>
                    <span className="stat-value" style={{ fontSize: '1rem' }}>2</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Google + Bing</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Storage</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--warning-color)' }}>IndexedDB</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Local only</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <SearchHistory onSelectSearch={handleSelectHistory} refreshKey={historyRefreshKey} />
          )}

          {activeTab === 'settings' && (
            <SettingsView config={config} onUpdateConfig={updateConfig} />
          )}
        </div>
      </main>
    </div>
  );
}
