import { describe, it, expect } from 'vitest';
import { convertHtmlToMarkdown } from './htmlConverter';

describe('htmlConverter', () => {
  it('converts HTML to markdown', () => {
    const html = '<html><head><title>Test Page</title></head><body><main><h1>Hello</h1><p>World</p></main></body></html>';
    const result = convertHtmlToMarkdown(html);

    expect(result.title).toBe('Test Page');
    expect(result.markdown).toContain('# Hello');
    expect(result.markdown).toContain('World');
  });

  it('removes script and style tags', () => {
    const html = '<html><body><main><p>Content</p><script>alert("xss")</script><style>body{}</style></main></body></html>';
    const result = convertHtmlToMarkdown(html);

    expect(result.markdown).not.toContain('alert');
    expect(result.markdown).not.toContain('body{}');
  });

  it('truncates long content', () => {
    const longText = 'a'.repeat(6000);
    const html = `<html><body><main><p>${longText}</p></main></body></html>`;
    const result = convertHtmlToMarkdown(html);

    expect(result.markdown).toContain('Content truncated');
  });

  it('handles empty HTML', () => {
    const result = convertHtmlToMarkdown('');
    expect(result.markdown).toBe('');
  });
});
