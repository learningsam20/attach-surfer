import { useState, useCallback, useEffect } from 'react';
import { Search, FileText, Sparkles, ExternalLink, Loader2, X, Eye } from 'lucide-react';
import { searchIngestedContent } from '../services/ingestionService';
import { getDocumentSummary, saveDocumentSummary } from '../db/rxdb';
import { generateDocumentSummary } from '../services/summaryService';
import { highlightText } from '../utils/highlight';
import MarkdownViewer from './MarkdownViewer';

export default function SearchWithinResults({ onSelectResult }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Document AI summary state
  const [savedSummary, setSavedSummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryProgress, setSummaryProgress] = useState('');
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    if (!selectedItem) {
      setSavedSummary(null);
      setSummaryError(null);
      return;
    }

    let isMounted = true;
    getDocumentSummary({ fileId: selectedItem.id, url: selectedItem.url })
      .then(res => {
        if (isMounted) setSavedSummary(res);
      })
      .catch(() => {
        if (isMounted) setSavedSummary(null);
      });

    return () => { isMounted = false; };
  }, [selectedItem]);

  const handleGenerateDocSummary = async () => {
    if (!selectedItem || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    setSummaryError(null);
    setSummaryProgress('Analyzing document content with AI...');

    try {
      const docContent = selectedItem.content || '';
      const docTitle = selectedItem.filename || selectedItem.type || 'Document';
      const summaryText = await generateDocumentSummary(docContent, docTitle, (p) => setSummaryProgress(p));

      await saveDocumentSummary({
        fileId: selectedItem.id,
        url: selectedItem.url,
        filename: docTitle,
        summaryText
      });

      setSavedSummary({
        content: summaryText,
        createdAt: Date.now(),
        cached: true
      });
    } catch (err) {
      setSummaryError(err.message || 'Failed to generate document summary');
    } finally {
      setIsGeneratingSummary(false);
      setSummaryProgress('');
    }
  };

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      const searchResults = await searchIngestedContent(query.trim());
      setResults(searchResults);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  }, [query, isSearching]);

  const handleCardClick = (item) => {
    setSelectedItem(item);
    if (onSelectResult) {
      onSelectResult(item);
    }
  };

  const totalResults = results ? results.files.length + results.outputs.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={20} color="var(--primary-color)" />
          Search Ingested Content
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Search through all previously extracted pages and attachments using semantic similarity.
        </p>

        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="input"
              placeholder="Search within ingested content (e.g. WebLLM, inference, architecture)..."
              value={query || ''}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn"
              disabled={isSearching || !query.trim()}
              style={{ padding: '0.5rem 1rem' }}
            >
              {isSearching ? (
                <><Loader2 size={16} className="spinner" /> Searching...</>
              ) : (
                <><Search size={16} /> Search</>
              )}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="card" style={{ padding: '1rem', border: '1px solid var(--danger-color)' }}>
          <p style={{ color: 'var(--danger-color)', fontSize: '0.85rem' }}>{error}</p>
        </div>
      )}

      {selectedItem && (
        <div className="card animate-fade-in" style={{ padding: '1.25rem', border: '1px solid var(--primary-color)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className="badge badge-engine">{selectedItem.type || 'document'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                  {((selectedItem.score || 0) * 100).toFixed(0)}% match
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {selectedItem.filename || selectedItem.type || 'Document Content'}
              </h3>
              {selectedItem.url && (
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                >
                  <ExternalLink size={12} /> {selectedItem.url}
                </a>
              )}
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => setSelectedItem(null)}
              style={{ padding: '0.25rem 0.5rem' }}
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>

          {/* Document AI Summary Section */}
          <div style={{
            marginBottom: '1rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color="var(--primary-color)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Document AI Summary</span>
                {savedSummary && (
                  <span className="badge" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', fontSize: '0.7rem' }}>
                    Saved in DB • {new Date(savedSummary.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div>
                {savedSummary ? (
                  <button
                    className="btn btn-ghost"
                    onClick={handleGenerateDocSummary}
                    disabled={isGeneratingSummary}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                  >
                    {isGeneratingSummary ? (
                      <><Loader2 size={12} className="spinner" /> Regenerating...</>
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                ) : (
                  <button
                    className="btn btn-outline"
                    onClick={handleGenerateDocSummary}
                    disabled={isGeneratingSummary}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {isGeneratingSummary ? (
                      <><Loader2 size={12} className="spinner" /> {summaryProgress || 'Generating...'}</>
                    ) : (
                      <><Sparkles size={12} /> Generate AI Summary</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {savedSummary ? (
              <div style={{ marginTop: '0.5rem' }}>
                <MarkdownViewer
                  content={savedSummary.content}
                  title={`AI Summary - ${selectedItem.filename || selectedItem.type || 'Document'}`}
                  query={query}
                  maxHeight="220px"
                  allowFullscreen={false}
                />
              </div>
            ) : isGeneratingSummary ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.4rem 0' }}>
                <Loader2 size={14} className="spinner" /> {summaryProgress || 'Generating executive summary with in-browser AI...'}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                No summary generated yet. Click &quot;Generate AI Summary&quot; to summarize and save this document in the database.
              </div>
            )}

            {summaryError && (
              <div style={{ color: 'var(--danger-color)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                {summaryError}
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Full Extracted Document (Markdown)
          </div>
          <MarkdownViewer
            content={selectedItem.content || '*No text content available.*'}
            title={selectedItem.filename || selectedItem.type || 'Document'}
            query={query}
            maxHeight="450px"
            allowFullscreen={true}
            baseUrl={selectedItem.url || ''}
          />
        </div>
      )}

      {results && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <FileText size={14} />
            <span>{totalResults} results found</span>
          </div>

          {totalResults === 0 ? (
            <div className="empty-state">
              <Search size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h3>No results found</h3>
              <p>Try a different search query or ingest more content first.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.files.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                    Files & Pages ({results.files.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {results.files.map((file, idx) => {
                      const displayTitle = file.filename || (file.url ? file.url.split('/').pop().split('?')[0] : 'Document');
                      const rawContent = (file.content || '').replace(/^#+\s+[^\n]+\n+/, '').trim();
                      const snippet = rawContent.length > 180 ? rawContent.substring(0, 180) + '...' : (rawContent || 'No text preview available.');

                      return (
                        <div
                          key={file.id || `${file.url || 'file'}-${idx}`}
                          className="card"
                          style={{
                            padding: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            borderColor: selectedItem?.id === file.id ? 'var(--primary-color)' : undefined
                          }}
                          onClick={() => handleCardClick(file)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <FileText size={18} color="var(--primary-color)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                  {highlightText(displayTitle, query)}
                                </span>
                                <span className="badge badge-engine">{file.type || 'page'}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, marginLeft: 'auto' }}>
                                  {((file.score || 0) * 100).toFixed(0)}% match
                                </span>
                              </div>
                              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                {highlightText(snippet, query)}
                              </div>
                              {file.url && (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.75rem', color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink size={10} /> {file.url}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {results.outputs.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                    Summaries ({results.outputs.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {results.outputs.map((output, idx) => {
                      const rawContent = (output.content || '').trim();
                      const snippet = rawContent.length > 180 ? rawContent.substring(0, 180) + '...' : (rawContent || 'No summary preview available.');

                      return (
                        <div
                          key={output.id || `${output.type || 'output'}-${idx}`}
                          className="card"
                          style={{
                            padding: '1rem',
                            cursor: 'pointer',
                            borderColor: selectedItem?.id === output.id ? 'var(--primary-color)' : undefined
                          }}
                          onClick={() => handleCardClick(output)}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <Sparkles size={18} color="var(--primary-color)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI Summary</span>
                                <span className="badge badge-engine">{output.type || 'summary'}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600, marginLeft: 'auto' }}>
                                  {((output.score || 0) * 100).toFixed(0)}% match
                                </span>
                              </div>
                              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {highlightText(snippet, query)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
