import React from 'react';

/**
 * Escapes characters that have special meaning in regular expressions.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights matching words from a search query within the given text string.
 * Returns an array of text and <mark className="search-highlight"> elements,
 * or the original text if no query or matches exist.
 *
 * @param {string} text - The source text to display.
 * @param {string} query - The search query containing terms to highlight.
 * @returns {React.ReactNode}
 */
export function highlightText(text, query) {
  if (!text || typeof text !== 'string') return text || '';
  if (!query || typeof query !== 'string' || !query.trim()) return text;

  // Split query into terms, filtering out very short punctuation
  const terms = query
    .trim()
    .split(/[\s,+/]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (terms.length === 0) return text;

  // Deduplicate and sort descending by length so longer phrases match first
  const uniqueTerms = Array.from(new Set(terms)).sort((a, b) => b.length - a.length);
  const pattern = `(${uniqueTerms.map(escapeRegex).join('|')})`;
  const regex = new RegExp(pattern, 'gi');

  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, index) => {
    const isMatch = uniqueTerms.some(term => term.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
}
