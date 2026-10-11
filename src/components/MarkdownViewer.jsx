import { useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  Copy,
  Check,
  Download,
  Maximize2,
  Minimize2,
  Search,
  FileText,
  Clock,
  BookOpen
} from 'lucide-react';

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: true
});

function sanitizeHtml(html) {
  if (!html) return '';
  // Strip scripts and dangerous tags
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export default function MarkdownViewer({
  content = '',
  title = '',
  query = '',
  maxHeight = '420px',
  allowFullscreen = true,
  baseUrl = ''
}) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpandedFull, setIsExpandedFull] = useState(false);

  // Document metadata statistics
  const stats = useMemo(() => {
    if (!content) return { words: 0, chars: 0, readTime: 0 };
    const clean = content.replace(/[#*`_~[\]()]/g, ' ');
    const words = clean.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const readTime = Math.max(1, Math.ceil(words / 220));
    return { words, chars, readTime };
  }, [content]);

  // Convert markdown to sanitized HTML
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      const rawHtml = marked.parse(content);
      let safeHtml = sanitizeHtml(rawHtml);

      // Resolve relative image URLs if baseUrl is provided
      if (baseUrl) {
        safeHtml = safeHtml.replace(
          /<img\s+([^>]*?)src="((?!https?:\/\/|data:|blob:)[^"]+)"([^>]*)>/gi,
          (match, before, src, after) => {
            try {
              return `<img ${before}src="${new URL(src, baseUrl).href}"${after}>`;
            } catch {
              return match;
            }
          }
        );
      }

      // Add loading="lazy" to images
      safeHtml = safeHtml.replace(
        /<img\s+(?!.*?loading=)([^>]+)>/gi,
        '<img loading="lazy" $1>'
      );

      // Add target="_blank" and rel to links
      safeHtml = safeHtml.replace(
        /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="md-link"$2>'
      );

      // Inline query or search term highlighting
      const highlightTerm = searchTerm.trim() || query.trim();
      if (highlightTerm && highlightTerm.length >= 2) {
        const escaped = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match words outside HTML tags
        const regex = new RegExp(`(?![^<]*>)(${escaped})`, 'gi');
        safeHtml = safeHtml.replace(regex, '<mark class="highlight">$1</mark>');
      }

      return safeHtml;
    } catch (err) {
      console.warn('Failed to parse markdown:', err);
      return `<pre>${content}</pre>`;
    }
  }, [content, searchTerm, query, baseUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const filename = (title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_') + '.md';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!content) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
        No document content available.
      </div>
    );
  }

  const containerStyle = isFullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'var(--bg-color)',
        padding: '1.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)'
      }
    : {
        position: 'relative',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };

  const bodyStyle = isFullscreen
    ? {
        flex: 1,
        overflowY: 'auto',
        padding: '1.5rem',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%'
      }
    : {
        overflowY: 'auto',
        maxHeight: isExpandedFull ? 'none' : maxHeight,
        padding: '1rem'
      };

  return (
    <div className={`markdown-viewer ${isFullscreen ? 'markdown-fullscreen' : ''}`} style={containerStyle}>
      {/* Viewer Header / Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(0, 0, 0, 0.15)',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.75rem'
      }}>
        {/* Left: Stats & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
            <FileText size={12} />
            {stats.words.toLocaleString()} words ({stats.chars.toLocaleString()} chars)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
            <Clock size={12} />
            ~{stats.readTime} min read
          </span>
          {stats.chars > 10000 && (
            <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--card-bg)' }}>
              Full Document Uncut
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Inline search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={11} style={{ position: 'absolute', left: '6px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Find in doc..."
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.4rem 0.2rem 1.4rem',
                background: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-main)',
                width: '100px'
              }}
            />
          </div>

          <button
            className="btn btn-ghost"
            onClick={handleCopy}
            title="Copy Markdown"
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            {copied ? <Check size={12} color="var(--success-color)" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            className="btn btn-ghost"
            onClick={handleDownload}
            title="Download .md file"
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Download size={12} />
            Export .md
          </button>

          {!isFullscreen && (
            <button
              className="btn btn-ghost"
              onClick={() => setIsExpandedFull(!isExpandedFull)}
              title={isExpandedFull ? 'Collapse view' : 'Expand full content'}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
            >
              {isExpandedFull ? 'Collapse' : 'Full Height'}
            </button>
          )}

          {allowFullscreen && (
            <button
              className="btn btn-ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Open Reader Mode'}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {isFullscreen ? 'Exit' : 'Reader View'}
            </button>
          )}
        </div>
      </div>

      {/* Rendered Markdown Body */}
      <div
        className="markdown-rendered-body"
        style={bodyStyle}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
