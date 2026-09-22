import React from 'react';
import { ExternalLink, Eye, EyeOff, Loader2, FileText, Globe } from 'lucide-react';

export default function ResultCard({ result, index, content, onToggleContent, isExpanded }) {
  const rank = index + 1;

  return (
    <div className="result-card animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="rank">{rank}</div>

      <div className="result-header">
        <div style={{ flex: 1 }}>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="result-title"
          >
            {result.title}
            <ExternalLink size={12} style={{ marginLeft: '0.3rem', opacity: 0.5 }} />
          </a>
          <div className="result-url">{result.displayUrl || result.url}</div>
        </div>
      </div>

      {result.snippet && (
        <div className="result-snippet">{result.snippet}</div>
      )}

      <div className="result-meta">
        <span className="badge badge-engine">
          <Globe size={10} style={{ marginRight: '0.2rem' }} />
          {result.engine}
        </span>
        {result.hasAttachment && (
          <span className="badge badge-attachment">
            <FileText size={10} style={{ marginRight: '0.2rem' }} />
            Attachment
          </span>
        )}
      </div>

      <div className="result-actions">
        <button
          className="btn btn-ghost"
          onClick={() => onToggleContent(result.url)}
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
        >
          {isExpanded ? (
            <><EyeOff size={14} /> Hide Content</>
          ) : content?.loading ? (
            <><Loader2 size={14} className="spinner" /> Extracting...</>
          ) : content?.success ? (
            <><Eye size={14} /> View Extracted Content</>
          ) : (
            <><FileText size={14} /> Extract Page Content</>
          )}
        </button>
      </div>

      {isExpanded && content && (
        <div className="result-content-preview animate-slide-up">
          {content.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="spinner" /> Extracting content...
            </div>
          ) : (
            <div>
              {content.title && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {content.title}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{content.markdown}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
