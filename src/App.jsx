import { useState, useEffect, useCallback } from 'react';
import {
  Search, Settings, Clock, Sun, Moon, ChevronLeft, ChevronRight,
  Loader2, Sparkles, Compass, BarChart3, Database, Paperclip, Globe, AlertCircle
} from 'lucide-react';
import { checkHardwareCapabilities } from './utils/hardwareCheck';
import { search, filterByAttachment, deduplicateResults } from './services/searchService';
import { extractPageContent } from './services/extractService';
import { generateSummary } from './services/summaryService';
import { trackEvent } from './services/telemetryService';
import { ensureUser, createRun, updateRun, addFile, addOutput, generateEmbedding, getDatabase } from './db/rxdb';
import { resetAIEngines, cleanProgressMessage } from './utils/aiEngine';
import { resetEmbeddingPipeline } from './services/embeddingService';
import HardwareWarning from './components/HardwareWarning';
import SearchBar from './components/SearchBar';
import ResultCard from './components/ResultCard';
import SummaryPanel from './components/SummaryPanel';
import SettingsView from './components/SettingsView';
import SearchHistory from './components/SearchHistory';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SearchWithinResults from './components/SearchWithinResults';

const VERSION = '1.0.0';

export default function App() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('attachSurferConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { defaultAttachmentFilter: 'with', ...parsed };
      }
    } catch {
      // ignore
    }
    return null;
  });
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
  const [unfilteredResults, setUnfilteredResults] = useState([]);
  const [lastSearchMeta, setLastSearchMeta] = useState(null);
  const [currentRunId, setCurrentRunId] = useState(null);
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
        let initial = { defaultAttachmentFilter: 'with', ...defaultData };
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            initial = { defaultAttachmentFilter: 'with', ...defaultData, ...parsed };
          } catch {
            // ignore
          }
        }
        setConfig(initial);
        localStorage.setItem('attachSurferConfig', JSON.stringify(initial));
      })
      .catch(() => {
        const saved = localStorage.getItem('attachSurferConfig');
        if (saved) {
          try { setConfig({ defaultAttachmentFilter: 'with', ...JSON.parse(saved) }); } catch {}
        }
      });
  }, []);

  useEffect(() => {
    if (config) {
      const { warnings } = checkHardwareCapabilities();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHardwareWarnings(warnings);
    }
  }, [config]);

  const updateConfig = (newConfig) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('attachSurferConfig', JSON.stringify(updated));
    resetAIEngines();
    resetEmbeddingPipeline();
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

    try {
      const selectedEngine = engine || config?.defaultEngine || 'all';
      const count = resultCount || config?.resultCount || 3;

      const isValidApiKey = (key) => {
        if (!key) return false;
        const trimmed = String(key).trim();
        return !!trimmed && trimmed !== 'YOUR_BING_KEY_HERE' && !(trimmed.startsWith('YOUR_') && trimmed.endsWith('_HERE'));
      };

      const hasBing = isValidApiKey(config?.bingApiKey || import.meta.env.VITE_BING_API_KEY);
      const hasGoogle = !!(isValidApiKey(config?.googleApiKey || import.meta.env.VITE_GOOGLE_API_KEY) && (config?.googleCx || import.meta.env.VITE_GOOGLE_CX));
      const hasBrightData = isValidApiKey(config?.brightDataApiKey || import.meta.env.VITE_BRIGHTDATA_API_KEY);

      if (!hasBing && !hasGoogle && !hasBrightData) {
        setSearchProgress('');
        setSummaryError('No search API keys configured. Add VITE_BING_API_KEY, VITE_GOOGLE_API_KEY + VITE_GOOGLE_CX, or VITE_BRIGHTDATA_API_KEY to your .env file.');
        setIsSearching(false);
        return;
      }

      if (selectedEngine === 'google' && !hasGoogle) {
        setSearchProgress('');
        setSummaryError('Google API key not configured. Add VITE_GOOGLE_API_KEY and VITE_GOOGLE_CX to .env, or switch engines.');
        setIsSearching(false);
        return;
      }

      if (selectedEngine === 'bing' && !hasBing) {
        setSearchProgress('');
        setSummaryError('Bing API key not configured. Add VITE_BING_API_KEY to .env, or switch engines.');
        setIsSearching(false);
        return;
      }

      if (selectedEngine === 'brightdata' && !hasBrightData) {
        setSearchProgress('');
        setSummaryError('Bright Data API key not configured. Add VITE_BRIGHTDATA_API_KEY to .env, or switch engines.');
        setIsSearching(false);
        return;
      }

      setSearchProgress(`Searching with ${selectedEngine === 'all' ? 'all engines' : selectedEngine}...`);

      const selectedAttachmentFilter = attachmentFilter || config?.defaultAttachmentFilter || 'with';

      const searchStartTime = performance.now();
      const rawResults = deduplicateResults(await search(query, selectedEngine, count, { attachmentFilter: selectedAttachmentFilter }));
      const searchDurationMs = Math.round(performance.now() - searchStartTime);

      setUnfilteredResults(rawResults);

      let results = rawResults;
      if (selectedAttachmentFilter !== 'all') {
        results = deduplicateResults(filterByAttachment(rawResults, selectedAttachmentFilter));
      }

      const searchMeta = {
        query,
        engine: selectedEngine,
        attachmentFilter: selectedAttachmentFilter,
        count,
        totalRaw: rawResults.length,
        totalFiltered: results.length,
        searchDurationMs
      };
      setLastSearchMeta(searchMeta);
      setSearchResults(results);

      let extractionDurationMs = 0;

      if (results.length > 0) {
        setSearchProgress('Extracting content from pages & attachments...');
        await ensureUser('default');
        const run = await createRun('default', query, selectedEngine);
        const runId = run.id;
        setCurrentRunId(runId);

        const extractStartTime = performance.now();
        const contentPromises = results.map(r => extractPageContent(r.url, r.snippet));
        const contentResults = await Promise.allSettled(contentPromises);
        extractionDurationMs = Math.round(performance.now() - extractStartTime);

        const newContents = {};
        const fileIds = [];

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const contentResult = contentResults[i];

          if (contentResult.status === 'fulfilled') {
            newContents[r.url] = contentResult.value;
          } else {
            newContents[r.url] = {
              url: r.url,
              type: 'error',
              markdown: r.snippet || 'Failed to extract content',
              success: false
            };
          }

          const content = newContents[r.url];
          const textContent = content?.markdown || r.snippet || r.title || 'Document';
          const embedding = await generateEmbedding(textContent);

          const file = await addFile(runId, 'default', {
            url: r.url,
            filename: r.title || r.url.split('/').pop(),
            type: content?.type || 'page',
            mimeType: 'text/plain',
            content: textContent,
            embedding,
            metadata: {
              rank: r.rank,
              engine: r.engine,
              displayUrl: r.displayUrl
            }
          });
          fileIds.push(file.id);
        }

        // Store search_results output for instant restore from history
        await addOutput(runId, 'default', {
          type: 'search_results',
          content: JSON.stringify({ results, meta: searchMeta }),
          metadata: { results, lastSearchMeta: searchMeta, searchDurationMs, extractionDurationMs }
        });

        await updateRun(runId, {
          status: 'completed',
          completedAt: Date.now(),
          fileIds
        });

        setContents(newContents);
        setHistoryRefreshKey(k => k + 1);
      }

      const totalDurationMs = searchDurationMs + extractionDurationMs;
      trackEvent('search', {
        query,
        engine: selectedEngine,
        resultCount: results.length,
        attachmentFilter,
        searchDurationMs,
        extractionDurationMs,
        totalDurationMs
      });

      setSearchProgress('');
    } catch (err) {
      console.error('Search error:', err);
      setSearchProgress(`Search failed: ${err.message}`);
      trackEvent('search_error', { query, error: err.message });
    } finally {
      setIsSearching(false);
    }
  }, [config]);

  const handleShowUnfiltered = async () => {
    if (!unfilteredResults || unfilteredResults.length === 0) return;
    const dedupedAll = deduplicateResults(unfilteredResults);
    setSearchResults(dedupedAll);
    setLastSearchMeta(prev => prev ? { ...prev, attachmentFilter: 'all', totalFiltered: dedupedAll.length } : null);

    setSearchProgress('Extracting content & generating embeddings from web pages...');
    try {
      const contentPromises = unfilteredResults.map(r => extractPageContent(r.url, r.snippet));
      const contentResults = await Promise.allSettled(contentPromises);
      const newContents = {};
      const fileIds = [];

      const runs = await getDatabase();
      const latestRun = await runs.runs.find({
        selector: { userId: 'default' },
        sort: [{ startedAt: 'desc' }]
      }).limit(1).exec();
      const runId = latestRun[0]?.id;

      for (let i = 0; i < unfilteredResults.length; i++) {
        const r = unfilteredResults[i];
        const contentResult = contentResults[i];
        newContents[r.url] = contentResult.status === 'fulfilled'
          ? contentResult.value
          : { url: r.url, type: 'error', markdown: r.snippet || 'Failed to extract content', success: false };

        const content = newContents[r.url];
        const textContent = content?.markdown || r.snippet || r.title || 'Document';
        const embedding = await generateEmbedding(textContent);

        if (runId) {
          const file = await addFile(runId, 'default', {
            url: r.url,
            filename: r.title || r.url.split('/').pop(),
            type: content?.type || 'page',
            mimeType: 'text/plain',
            content: textContent,
            embedding,
            metadata: {
              rank: r.rank,
              engine: r.engine,
              displayUrl: r.displayUrl
            }
          });
          fileIds.push(file.id);
        }
      }

      if (runId && fileIds.length > 0) {
        await updateRun(runId, { fileIds });
      }

      setContents(prev => ({ ...prev, ...newContents }));
    } catch (err) {
      console.warn('Extraction warning:', err);
    } finally {
      setSearchProgress('');
    }
  };

  const handleToggleContent = useCallback((url) => {
    setExpandedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
        if (!contents[url]) {
          const matchItem = searchResults.find(r => r.url === url) || (unfilteredResults || []).find(r => r.url === url);
          extractPageContent(url, matchItem?.snippet).then(content => {
            setContents(prev => ({ ...prev, [url]: content }));
          });
        }
      }
      return next;
    });
  }, [contents, searchResults, unfilteredResults]);

  const handleGenerateSummary = useCallback(async () => {
    if (searchResults.length === 0) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);

    const llmStartTime = performance.now();
    try {
      const result = await generateSummary(searchResults, contents, (progress) => {
        setSearchProgress(cleanProgressMessage(progress));
      });
      const llmSummaryDurationMs = Math.round(performance.now() - llmStartTime);
      setSummary(result);

      trackEvent('summary_generate', {
        query: lastSearchMeta?.query || '',
        resultCount: searchResults.length,
        llmSummaryDurationMs
      });

      const targetRunId = currentRunId || (await (async () => {
        const db = await getDatabase();
        const latest = await db.runs.find({ selector: { userId: 'default' }, sort: [{ startedAt: 'desc' }] }).limit(1).exec();
        return latest[0]?.id;
      })());

      if (targetRunId) {
        const embedding = await generateEmbedding(result);
        await addOutput(targetRunId, 'default', {
          type: 'summary',
          content: result,
          embedding,
          metadata: { llmSummaryDurationMs, query: lastSearchMeta?.query || '' }
        });
      }
    } catch (err) {
      console.error('Summary generation failed:', err);
      setSummaryError(err.message);
    } finally {
      setIsGeneratingSummary(false);
      setSearchProgress('');
    }
  }, [searchResults, contents, currentRunId, lastSearchMeta]);

  const handleSelectHistory = useCallback(async (search) => {
    setActiveTab('search');
    try {
      const db = await getDatabase();
      const runId = search.id;
      if (runId && db) {
        const runDoc = await db.runs.findOne({ selector: { id: runId } }).exec();
        const outputs = await db.outputs.find({ selector: { runId } }).exec();
        const files = await db.files.find({ selector: { runId } }).exec();

        let restoredResults = [];
        let restoredMeta = null;

        const resultsOutput = outputs.find(o => o.type === 'search_results');
        if (resultsOutput) {
          try {
            const parsed = typeof resultsOutput.content === 'string' ? JSON.parse(resultsOutput.content) : resultsOutput.content;
            restoredResults = parsed.results || [];
            restoredMeta = parsed.meta || null;
          } catch {
            restoredResults = resultsOutput.metadata?.results || [];
            restoredMeta = resultsOutput.metadata?.lastSearchMeta || null;
          }
        }

        if (restoredResults.length === 0 && files.length > 0) {
          restoredResults = files.map((f, i) => {
            const fileData = typeof f.toJSON === 'function' ? f.toJSON() : f;
            return {
              rank: fileData.metadata?.rank || (i + 1),
              title: fileData.filename || 'Document',
              url: fileData.url,
              displayUrl: fileData.metadata?.displayUrl || fileData.url,
              snippet: fileData.content ? fileData.content.slice(0, 250) : '',
              engine: fileData.metadata?.engine || runDoc?.engine || 'Web',
              hasAttachment: fileData.type === 'attachment'
            };
          });
        }

        const restoredContents = {};
        for (const f of files) {
          const fileData = typeof f.toJSON === 'function' ? f.toJSON() : f;
          restoredContents[fileData.url] = {
            url: fileData.url,
            type: fileData.type || 'page',
            title: fileData.filename,
            markdown: fileData.content,
            success: true
          };
        }

        const summaryOutput = outputs.find(o => o.type === 'summary');
        const restoredSummary = summaryOutput ? summaryOutput.content : null;

        if (restoredResults.length > 0) {
          setCurrentRunId(runId);
          setSearchResults(restoredResults);
          setUnfilteredResults(restoredResults);
          setContents(restoredContents);
          setSummary(restoredSummary);
          setSummaryError(null);
          setSearchProgress('');
          setLastSearchMeta(restoredMeta || {
            query: search.query,
            engine: search.engine || 'all',
            attachmentFilter: 'all',
            count: restoredResults.length,
            totalRaw: restoredResults.length,
            totalFiltered: restoredResults.length
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore search results from history:', err);
    }

    // Fallback to fresh search if not cached in DB
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
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'search-content', label: 'Search Content', icon: <Database size={18} /> },
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
              <SearchBar
                onSearch={handleSearch}
                isSearching={isSearching}
                defaultEngine={config?.defaultEngine || 'all'}
                defaultResultCount={config?.resultCount || 3}
                defaultAttachmentFilter={config?.defaultAttachmentFilter || 'with'}
              />

              {searchResults.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  {/* AI Summary at the TOP with collapsible panel */}
                  <SummaryPanel
                    summary={summary}
                    isGenerating={isGeneratingSummary}
                    error={summaryError}
                    query={lastSearchMeta?.query || ''}
                  />

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
                        <><Sparkles size={14} /> {summary ? 'Regenerate Summary' : 'Generate Summary'}</>
                      )}
                    </button>
                  </div>

                  <div className="result-list">
                    {searchResults.map((result, i) => (
                      <ResultCard
                        key={`${result.url}-${i}`}
                        result={result}
                        query={lastSearchMeta?.query || ''}
                        index={i}
                        content={contents[result.url]}
                        onToggleContent={handleToggleContent}
                        isExpanded={expandedUrls.has(result.url)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state when search returned 0 results */}
              {searchResults.length === 0 && lastSearchMeta && !isSearching && (
                <div className="card" style={{ marginTop: '1.5rem', padding: '2rem', textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    padding: '0.85rem',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary-color)',
                    marginBottom: '1rem'
                  }}>
                    <Paperclip size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                    {lastSearchMeta.attachmentFilter === 'with'
                      ? `No direct attachments found for "${lastSearchMeta.query}"`
                      : `No results found for "${lastSearchMeta.query}"`}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: '1.5' }}>
                    {lastSearchMeta.attachmentFilter === 'with'
                      ? (unfilteredResults.length > 0
                          ? `We found ${unfilteredResults.length} web page results from ${lastSearchMeta.engine}, but none matched file attachment formats (.pdf, .docx, .xlsx, .pptx).`
                          : `The search engine returned 0 results for this query. Try adding specific file keywords or switching the engine.`)
                      : `No results returned from ${lastSearchMeta.engine}. Check your API keys in Settings or try a different search phrase.`}
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {lastSearchMeta.attachmentFilter === 'with' && unfilteredResults.length > 0 && (
                      <button
                        className="btn"
                        onClick={handleShowUnfiltered}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <Globe size={16} /> Show {unfilteredResults.length} Web Results Without Filter
                      </button>
                    )}
                    <button
                      className="btn"
                      onClick={() => handleSearch({
                        query: lastSearchMeta.query,
                        engine: lastSearchMeta.engine,
                        attachmentFilter: 'all',
                        resultCount: lastSearchMeta.count || 3
                      })}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <Search size={16} /> Search Again (Don't Filter)
                    </button>
                  </div>
                </div>
              )}

              {/* Initial splash state when no search has been performed yet */}
              {searchResults.length === 0 && !lastSearchMeta && !isSearching && (
                <div className="stats-grid" style={{ marginTop: '2rem' }}>
                  <div className="stat-card">
                    <span className="stat-label">Privacy</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--success-color)' }}>100%</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>All processing in-browser</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">AI Engine</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--primary-color)' }}>In-Browser</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Phi-4 / Gemma-4 WebGPU</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Engines</span>
                    <span className="stat-value" style={{ fontSize: '1rem' }}>3</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BrightData + Google + Bing</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-label">Storage</span>
                    <span className="stat-value" style={{ fontSize: '1rem', color: 'var(--warning-color)' }}>IndexedDB</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Local only (RxDB)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <SearchHistory onSelectSearch={handleSelectHistory} refreshKey={historyRefreshKey} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard />
          )}

          {activeTab === 'search-content' && (
            <SearchWithinResults />
          )}

          {activeTab === 'settings' && (
            <SettingsView config={config} onUpdateConfig={updateConfig} />
          )}
        </div>
      </main>
    </div>
  );
}
