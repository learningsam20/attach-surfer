import React from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

export default function SummaryPanel({ summary, isGenerating, error }) {
  if (!summary && !isGenerating && !error) return null;

  return (
    <div className="summary-panel animate-slide-up">
      <h3>
        <Sparkles size={20} color="var(--primary-color)" />
        AI-Generated Summary
      </h3>

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
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isGenerating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', padding: '1rem 0' }}>
          <Loader2 size={20} className="spinner" />
          <span>Generating summary using AI. This may take a moment...</span>
        </div>
      )}

      {summary && (
        <div className="summary-content" style={{ whiteSpace: 'pre-wrap' }}>
          {summary}
        </div>
      )}
    </div>
  );
}
