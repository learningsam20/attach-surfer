import { useState, useEffect } from 'react';
import { ExternalLink, Eye, EyeOff, Loader2, FileText, Globe, Sparkles } from 'lucide-react';
import { highlightText } from '../utils/highlight';
import { getDocumentSummary, saveDocumentSummary } from '../db/rxdb';
import { generateDocumentSummary } from '../services/summaryService';

import MarkdownViewer from './MarkdownViewer';

export default function ResultCard({ result, index, content, onToggleContent, isExpanded, query = '' }) {
  const rank = index + 1;
  const [docSummary, setDocSummary] = useState(null);
  const [isGeneratingDocSummary, setIsGeneratingDocSummary] = useState(false);
  const [docSummaryProgress, setDocSummaryProgress] = useState('');
  const [docSummaryError, setDocSummaryError] = useState(null);

  useEffect(() => {
    if (!isExpanded || !result?.url) return;

    let isMounted = true;
    getDocumentSummary({ url: result.url })
      .then(res => {
        if (isMounted) setDocSummary(res);
      })
      .catch(() => {
        if (isMounted) setDocSummary(null);
      });

    return () => { isMounted = false; };
  }, [isExpanded, result?.url]);

  const handleGenerateSummary = async () => {
    const textToSummarize = content?.markdown || result?.snippet || '';
    if (!textToSummarize.trim() || isGeneratingDocSummary) return;

    setIsGeneratingDocSummary(true);
    setDocSummaryError(null);
    setDocSummaryProgress('Analyzing document with AI...');

    try {
      const summaryText = await generateDocumentSummary(
        textToSummarize,
        result.title || 'Document',
        (p) => setDocSummaryProgress(p)
      );

      await saveDocumentSummary({
        url: result.url,
        filename: result.title,
        summaryText
      });

      setDocSummary({
        content: summaryText,
        createdAt: Date.now(),
        cached: true
      });
    } catch (err) {
      setDocSummaryError(err.message || 'Failed to generate document summary');
    } finally {
      setIsGeneratingDocSummary(false);
      setDocSummaryProgress('');
    }
  };

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
            {highlightText(result.title, query)}
            <ExternalLink size={12} style={{ marginLeft: '0.3rem', opacity: 0.5 }} />
          </a>
          <div className="result-url">{result.displayUrl || result.url}</div>
        </div>
      </div>

      {result.snippet && (
        <div className="result-snippet">
          {highlightText(result.snippet, query)}
        </div>
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
              {/* Document AI Summary Box */}
              <div style={{
                marginBottom: '1rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                background: 'var(--bg-secondary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={14} color="var(--primary-color)" />
                    <strong style={{ fontSize: '0.85rem' }}>AI Summary</strong>
                    {docSummary && (
                      <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', fontSize: '0.65rem' }}>
                        Saved in DB • {new Date(docSummary.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div>
                    {docSummary ? (
                      <button
                        className="btn btn-ghost"
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingDocSummary}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      >
                        {isGeneratingDocSummary ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline"
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingDocSummary}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        {isGeneratingDocSummary ? (
                          <><Loader2 size={12} className="spinner" /> {docSummaryProgress || 'Generating...'}</>
                        ) : (
                          <><Sparkles size={12} /> Summarize Document</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {docSummary ? (
                  <div style={{ marginTop: '0.5rem' }}>
                    <MarkdownViewer
                      content={docSummary.content}
                      title={`AI Summary - ${result.title || 'Document'}`}
                      query={query}
                      maxHeight="220px"
                      allowFullscreen={false}
                    />
                  </div>
                ) : isGeneratingDocSummary ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.3rem 0' }}>
                    <Loader2 size={12} className="spinner" /> {docSummaryProgress || 'Generating document summary...'}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No summary saved for this document yet. Click &quot;Summarize Document&quot; to generate with AI and save to DB.
                  </div>
                )}

                {docSummaryError && (
                  <div style={{ color: 'var(--danger-color)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
                    {docSummaryError}
                  </div>
                )}
              </div>

              {content.title && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {content.title}
                </div>
              )}
              <MarkdownViewer
                content={content.markdown}
                title={content.title || result.title || 'Document'}
                query={query}
                maxHeight="450px"
                allowFullscreen={true}
                baseUrl={result.url}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
