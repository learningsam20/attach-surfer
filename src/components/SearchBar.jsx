import React, { useState } from 'react';
import { Search, Settings, Globe, Paperclip, Hash } from 'lucide-react';

export default function SearchBar({ onSearch, isSearching }) {
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState('all');
  const [attachmentFilter, setAttachmentFilter] = useState('all');
  const [resultCount, setResultCount] = useState(3);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;
    onSearch({ query: query.trim(), engine, attachmentFilter, resultCount });
  };

  return (
    <div className="search-hero">
      <h2>Smart Web Search with Attachment Extraction</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Search the web, extract content from pages and attachments, and get AI-powered summaries.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="search-bar-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-bar"
            placeholder="Enter your search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="btn search-submit-btn"
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? (
              <><span className="spinner" /> Searching...</>
            ) : (
              <><Search size={16} /> Search</>
            )}
          </button>
        </div>

        <div className="search-options">
          <div className="search-option">
            <Globe size={14} />
            <label>Engine:</label>
            <select
              className="select"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value="all">All (Google + Bing)</option>
              <option value="google">Google</option>
              <option value="bing">Bing</option>
            </select>
          </div>

          <div className="search-option">
            <Paperclip size={14} />
            <label>Attachments:</label>
            <select
              className="select"
              value={attachmentFilter}
              onChange={(e) => setAttachmentFilter(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value="all">Don't filter</option>
              <option value="with">With attachments only</option>
              <option value="without">Without attachments</option>
            </select>
          </div>

          <div className="search-option">
            <Hash size={14} />
            <label>Results:</label>
            <select
              className="select"
              value={resultCount}
              onChange={(e) => setResultCount(Number(e.target.value))}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>
      </form>
    </div>
  );
}
