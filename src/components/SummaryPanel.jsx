import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';

export default function SummaryPanel({ summary, isGenerating, error, query = '' }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!summary && !isGenerating && !error) return null;

  return (
    <div className="summary-panel animate-slide-up" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: isCollapsed ? 0 : '0.75rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
          <Sparkles size={18} color="var(--primary-color)" />
          AI-Generated Summary
          {summary && isCollapsed && (
            <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>
              Collapsed
            </span>
          )}
        </h3>

        {summary && (
          <button
            className="btn btn-ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title={isCollapsed ? 'Expand summary' : 'Collapse summary'}
          >
            {isCollapsed ? (
              <><ChevronDown size={14} /> Expand Summary</>
            ) : (
              <><ChevronUp size={14} /> Collapse Summary</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--danger-color)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: summary ? '0.75rem' : '0'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isGenerating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
          <Loader2 size={18} className="spinner" />
          <span style={{ fontSize: '0.85rem' }}>Generating summary using AI. This may take a moment...</span>
        </div>
      )}

      {summary && !isCollapsed && (
        <div className="summary-content" style={{ marginTop: '0.25rem' }}>
          <MarkdownViewer
            content={summary}
            title={query ? `Summary: ${query}` : 'AI-Generated Summary'}
            query={query}
            maxHeight="500px"
            allowFullscreen={true}
          />
        </div>
      )}
    </div>
  );
}
