import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPageContent } from './extractService';

describe('extractService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns attachment info for PDF URLs', async () => {
    const result = await extractPageContent('https://example.com/document.pdf');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
    expect(result.filename).toBe('document.pdf');
    expect(result.markdown).toContain('Attachment detected');
  });

  it('returns attachment info for DOCX URLs', async () => {
    const result = await extractPageContent('https://example.com/report.docx');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
    expect(result.filename).toBe('report.docx');
  });

  it('returns attachment info for XLSX URLs', async () => {
    const result = await extractPageContent('https://example.com/data.xlsx');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
  });

  it('returns attachment info for CSV URLs', async () => {
    const result = await extractPageContent('https://example.com/data.csv');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
  });

  it('returns attachment info for PPTX URLs', async () => {
    const result = await extractPageContent('https://example.com/slides.pptx');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
  });

  it('returns attachment info for ZIP URLs', async () => {
    const result = await extractPageContent('https://example.com/archive.zip');
    expect(result.type).toBe('attachment');
    expect(result.success).toBe(true);
  });

  it('handles query parameters in attachment URLs', async () => {
    const result = await extractPageContent('https://example.com/doc.pdf?download=1');
    expect(result.filename).toBe('doc.pdf');
  });

  it('returns error for failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await extractPageContent('https://example.com/page');
    expect(result.type).toBe('error');
    expect(result.success).toBe(false);
    expect(result.markdown).toContain('Could not extract content');
  });

  it('returns error for non-ok HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/html' })
    }));

    const result = await extractPageContent('https://example.com/missing');
    expect(result.type).toBe('error');
    expect(result.success).toBe(false);
  });

  it('extracts and converts HTML content to markdown', async () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <main>
            <h1>Hello World</h1>
            <p>This is a test paragraph.</p>
            <ul><li>Item 1</li><li>Item 2</li></ul>
          </main>
        </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(html)
    }));

    const result = await extractPageContent('https://example.com/page');
    expect(result.type).toBe('page');
    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Page');
    expect(result.markdown).toContain('Hello World');
    expect(result.markdown).toContain('This is a test paragraph');
  });

  it('preserves full long content without truncation', async () => {
    const longText = 'a'.repeat(8000);
    const html = `<html><body><main><p>${longText}</p></main></body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: () => Promise.resolve(html)
    }));

    const result = await extractPageContent('https://example.com/long');
    expect(result.success).toBe(true);
    expect(result.markdown).toContain(longText);
    expect(result.markdown).not.toContain('Content truncated');
  });
});
