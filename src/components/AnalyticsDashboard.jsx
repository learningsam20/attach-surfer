import { useState, useEffect } from 'react';
import { BarChart3, Trash2, TrendingUp, Search, Sparkles, AlertCircle } from 'lucide-react';
import { getTelemetryEvents, clearTelemetry, getEventCounts } from '../services/telemetryService';

export default function AnalyticsDashboard() {
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({});
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [eventList, eventCounts] = await Promise.all([
        getTelemetryEvents(50),
        getEventCounts()
      ]);
      setEvents(eventList);
      setCounts(eventCounts);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const handleClear = async () => {
    try {
      await clearTelemetry();
      setEvents([]);
      setCounts({});
      setShowConfirmClear(false);
    } catch (err) {
      console.error('Failed to clear telemetry:', err);
    }
  };

  const totalEvents = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const getEventIcon = (eventName) => {
    switch (eventName) {
      case 'search': return <Search size={14} />;
      case 'summary_generate': return <Sparkles size={14} />;
      case 'search_error': return <AlertCircle size={14} />;
      default: return <TrendingUp size={14} />;
    }
  };

  const getEventColor = (eventName) => {
    switch (eventName) {
      case 'search': return 'var(--primary-color)';
      case 'summary_generate': return 'var(--success-color)';
      case 'search_error': return 'var(--danger-color)';
      default: return 'var(--text-muted)';
    }
  };

  if (isLoading) {
    return (
      <div className="empty-state">
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} color="var(--primary-color)" />
            Analytics Dashboard
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Local usage statistics. All data stays in your browser.
          </p>
        </div>
        {totalEvents > 0 && (
          <button
            className="btn btn-danger"
            onClick={() => setShowConfirmClear(true)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
          >
            <Trash2 size={14} /> Clear Data
          </button>
        )}
      </div>

      {showConfirmClear && (
        <div className="card" style={{ border: '1px solid var(--danger-color)', padding: '1rem' }}>
          <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Clear all analytics data? This cannot be undone.</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger" onClick={handleClear}>Yes, Clear All</button>
            <button className="btn btn-outline" onClick={() => setShowConfirmClear(false)}>Cancel</button>
          </div>
        </div>
      )}

      {totalEvents === 0 ? (
        <div className="empty-state">
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3>No analytics data yet</h3>
          <p>Start using the app to see usage statistics.</p>
        </div>
      ) : (
        <>
          {(() => {
            const searchEvents = events.filter(e => (e.metadata?.event || e.event) === 'search' && (e.metadata?.data?.searchDurationMs || e.data?.searchDurationMs));
            const avgSearch = searchEvents.length > 0
              ? Math.round(searchEvents.reduce((acc, e) => acc + (e.metadata?.data?.searchDurationMs || e.data?.searchDurationMs || 0), 0) / searchEvents.length)
              : null;

            const summaryEvents = events.filter(e => (e.metadata?.event || e.event) === 'summary_generate' && (e.metadata?.data?.llmSummaryDurationMs || e.data?.llmSummaryDurationMs));
            const avgLlm = summaryEvents.length > 0
              ? Math.round(summaryEvents.reduce((acc, e) => acc + (e.metadata?.data?.llmSummaryDurationMs || e.data?.llmSummaryDurationMs || 0), 0) / summaryEvents.length)
              : null;

            return (
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <div className="stat-card">
                  <span className="stat-label">Total Events</span>
                  <span className="stat-value">{totalEvents}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Searches</span>
                  <span className="stat-value">{counts.search || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Avg Search Time</span>
                  <span className="stat-value">{avgSearch !== null ? `${avgSearch}ms` : '—'}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Summaries</span>
                  <span className="stat-value">{counts.summary_generate || 0}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Avg LLM Summary</span>
                  <span className="stat-value">{avgLlm !== null ? (avgLlm > 1000 ? `${(avgLlm / 1000).toFixed(1)}s` : `${avgLlm}ms`) : '—'}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Errors</span>
                  <span className="stat-value" style={{ color: counts.search_error ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    {counts.search_error || 0}
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Event Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([eventName, count]) => (
                  <div key={eventName} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: getEventColor(eventName), display: 'flex', alignItems: 'center' }}>
                      {getEventIcon(eventName)}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem' }}>{eventName}</span>
                    <div style={{ flex: 2, height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / totalEvents) * 100}%`,
                        background: getEventColor(eventName),
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '2rem', textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Recent Events</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
              {events.map((event, i) => {
                const eventName = event.metadata?.event || event.event || 'event';
                const timestamp = event.createdAt || event.timestamp || Date.now();
                const data = event.metadata?.data || event.data || {};
                const dateObj = new Date(timestamp);
                const dateStr = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleString()
                  : 'Just now';

                // Format friendly details string
                let detailText = '';
                if (data.query) {
                  detailText = `Query: "${data.query}"`;
                  if (data.engine) detailText += ` • Engine: ${data.engine}`;
                  if (data.resultCount !== undefined) detailText += ` • Results: ${data.resultCount}`;
                  if (data.searchDurationMs !== undefined) detailText += ` • Search: ${data.searchDurationMs}ms`;
                  if (data.extractionDurationMs !== undefined) detailText += ` • Extract: ${data.extractionDurationMs}ms`;
                } else if (data.resultCount !== undefined) {
                  detailText = `${data.resultCount} search results processed`;
                } else if (data.error) {
                  detailText = `Error: ${data.error}`;
                  if (data.query) detailText += ` (Query: "${data.query}")`;
                } else if (Object.keys(data).length > 0) {
                  detailText = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' • ');
                }
                if (data.llmSummaryDurationMs !== undefined) {
                  detailText += `${detailText ? ' • ' : ''}LLM Time: ${data.llmSummaryDurationMs > 1000 ? (data.llmSummaryDurationMs / 1000).toFixed(1) + 's' : data.llmSummaryDurationMs + 'ms'}`;
                }

                return (
                  <div key={event.id || i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <span style={{ color: getEventColor(eventName), display: 'flex', alignItems: 'center', marginTop: '0.2rem' }}>
                      {getEventIcon(eventName)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{eventName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dateStr}</div>
                      </div>
                      {detailText && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', wordBreak: 'break-word' }}>
                          {detailText}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
