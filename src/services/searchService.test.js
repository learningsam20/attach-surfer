import { describe, it, expect, vi, beforeEach } from 'vitest';
import { search, filterByAttachment, searchBrightData, normalizeUrl, deduplicateResults } from './searchService';

vi.stubEnv('VITE_BING_API_KEY', 'test-bing-key');
vi.stubEnv('VITE_GOOGLE_API_KEY', 'test-google-key');
vi.stubEnv('VITE_GOOGLE_CX', 'test-cx');
vi.stubEnv('VITE_BRIGHTDATA_API_KEY', 'test-brightdata-key');

describe('searchService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('VITE_BING_API_KEY', 'test-bing-key');
    vi.stubEnv('VITE_GOOGLE_API_KEY', 'test-google-key');
    vi.stubEnv('VITE_GOOGLE_CX', 'test-cx');
    vi.stubEnv('VITE_BRIGHTDATA_API_KEY', 'test-brightdata-key');
  });

  describe('filterByAttachment', () => {
    const mockResults = [
      { url: 'https://example.com/doc.pdf', title: 'PDF' },
      { url: 'https://example.com/page.html', title: 'Page' },
      { url: 'https://example.com/data.csv', title: 'CSV' },
      { url: 'https://example.com/attachment/file.docx', title: 'DOCX' },
      { url: 'https://example.com/document/report.pdf', title: 'Report' },
      { url: 'https://example.com/file/download.zip', title: 'ZIP' },
      { url: 'https://example.com/about', title: 'About' },
    ];

    it('returns all results when filter is "all"', () => {
      const filtered = filterByAttachment(mockResults, 'all');
      expect(filtered).toHaveLength(7);
    });

    it('filters results with attachments when filter is "with"', () => {
      const filtered = filterByAttachment(mockResults, 'with');
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(r => {
        expect(
          /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i.test(r.url) ||
          r.url.includes('/attachment') ||
          r.url.includes('/document') ||
          r.url.includes('/file')
        ).toBe(true);
      });
    });

    it('filters results without attachments when filter is "without"', () => {
      const filtered = filterByAttachment(mockResults, 'without');
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(r => {
        expect(
          /\.(pdf|docx?|xlsx?|pptx?|csv|txt|zip|rar)$/i.test(r.url) ||
          r.url.includes('/attachment') ||
          r.url.includes('/document') ||
          r.url.includes('/file')
        ).toBe(false);
      });
    });

    it('detects PDF files', () => {
      const filtered = filterByAttachment(mockResults, 'with');
      expect(filtered.some(r => r.url.includes('.pdf'))).toBe(true);
    });

    it('detects document paths', () => {
      const filtered = filterByAttachment(mockResults, 'with');
      expect(filtered.some(r => r.url.includes('/document'))).toBe(true);
    });

    it('detects file paths', () => {
      const filtered = filterByAttachment(mockResults, 'with');
      expect(filtered.some(r => r.url.includes('/file'))).toBe(true);
    });

    it('detects URLs with query parameters and /pdf/ repositories', () => {
      const testCases = [
        { url: 'https://arxiv.org/pdf/2412.15803v2', title: 'WebLLM Paper' },
        { url: 'https://example.com/download.pdf?token=abc', title: 'Download' },
        { url: 'https://example.com/view', title: '[PDF] Architecture Spec' }
      ];
      const filtered = filterByAttachment(testCases, 'with');
      expect(filtered).toHaveLength(3);
    });
  });

  describe('searchBrightData', () => {
    it('throws error when API key is missing', async () => {
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', '');
      await expect(searchBrightData('query', 3)).rejects.toThrow('Bright Data API key not configured');
    });

    it('formats results correctly from parsed organic response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({
          organic: [
            {
              rank: 1,
              title: 'Bright Data Result',
              link: 'https://example.com/item1',
              display_link: 'example.com',
              description: 'This is a description from Bright Data.'
            }
          ]
        }),
        json: async () => ({
          organic: [
            {
              rank: 1,
              title: 'Bright Data Result',
              link: 'https://example.com/item1',
              display_link: 'example.com',
              description: 'This is a description from Bright Data.'
            }
          ]
        })
      });
      global.fetch = mockFetch;

      const results = await searchBrightData('test query', 2);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.brightdata.com/request',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-brightdata-key',
            'Content-Type': 'application/json'
          })
        })
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        rank: 1,
        title: 'Bright Data Result',
        url: 'https://example.com/item1',
        displayUrl: 'example.com',
        snippet: 'This is a description from Bright Data.',
        engine: 'BrightData'
      });
    });

    it('formats results correctly from HTML response', async () => {
      const sampleHtml = `
        <div class="result results_links">
          <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fhtml&amp;rut=1">HTML Result</a></h2>
          <div class="result__snippet"><a class="result__snippet">Sample snippet text</a></div>
        </div>
      `;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleHtml
      });

      const results = await searchBrightData('test query', 1);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        rank: 1,
        title: 'HTML Result',
        url: 'https://example.com/html',
        displayUrl: 'example.com',
        snippet: 'Sample snippet text',
        engine: 'BrightData'
      });
    });

    it('handles HTTP error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden access' })
      });

      await expect(searchBrightData('test', 3)).rejects.toThrow('Forbidden access');
    });
  });

  describe('search', () => {
    it('throws error when no API keys are configured', async () => {
      vi.stubEnv('VITE_BING_API_KEY', '');
      vi.stubEnv('VITE_GOOGLE_API_KEY', '');
      vi.stubEnv('VITE_GOOGLE_CX', '');
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', '');

      await expect(search('test', 'all', 3)).rejects.toThrow('No search API keys configured');
    });

    it('throws error when bing key is missing for bing engine', async () => {
      vi.stubEnv('VITE_BING_API_KEY', '');
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'key');
      vi.stubEnv('VITE_GOOGLE_CX', 'cx');
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', 'bd-key');

      await expect(search('test', 'bing', 3)).rejects.toThrow('No search API keys configured');
    });

    it('throws error when google keys are missing for google engine', async () => {
      vi.stubEnv('VITE_BING_API_KEY', 'key');
      vi.stubEnv('VITE_GOOGLE_API_KEY', '');
      vi.stubEnv('VITE_GOOGLE_CX', '');
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', 'bd-key');

      await expect(search('test', 'google', 3)).rejects.toThrow('No search API keys configured');
    });

    it('throws error when brightdata key is missing for brightdata engine', async () => {
      vi.stubEnv('VITE_BING_API_KEY', 'key');
      vi.stubEnv('VITE_GOOGLE_API_KEY', 'gkey');
      vi.stubEnv('VITE_GOOGLE_CX', 'cx');
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', '');

      await expect(search('test', 'brightdata', 3)).rejects.toThrow('No search API keys configured');
    });

    it('searches brightdata when engine is brightdata', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({
          organic: [
            {
              title: 'Bright Data Search',
              link: 'https://example.com/bd',
              description: 'Snippet'
            }
          ]
        }),
        json: async () => ({
          organic: [
            {
              title: 'Bright Data Search',
              link: 'https://example.com/bd',
              description: 'Snippet'
            }
          ]
        })
      });

      const results = await search('test', 'brightdata', 1);
      expect(results).toHaveLength(1);
      expect(results[0].engine).toBe('BrightData');
    });

    it('ignores placeholder Bing key', async () => {
      vi.stubEnv('VITE_BING_API_KEY', 'YOUR_BING_KEY_HERE');
      vi.stubEnv('VITE_GOOGLE_API_KEY', '');
      vi.stubEnv('VITE_GOOGLE_CX', '');
      vi.stubEnv('VITE_BRIGHTDATA_API_KEY', '');

      await expect(search('test', 'all', 3)).rejects.toThrow('No search API keys configured');
    });
  });

  describe('normalizeUrl', () => {
    it('normalizes case, trailing slashes, and removes marketing tracking parameters', () => {
      const raw = 'https://EXAMPLE.com/docs/file.pdf/?utm_source=twitter&utm_medium=cpc&fbclid=12345#page=2';
      expect(normalizeUrl(raw)).toBe('https://example.com/docs/file.pdf');
    });

    it('handles empty and invalid input gracefully', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl(null)).toBe('');
      expect(normalizeUrl('not-a-valid-url#frag/')).toBe('not-a-valid-url');
    });

    it('unwraps redirect wrappers such as DuckDuckGo uddg and Google url redirect', () => {
      const uddgUrl = 'https://html.duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fresearch.pdf&rut=123';
      expect(normalizeUrl(uddgUrl)).toBe('https://example.com/research.pdf');

      const googleRedirect = 'https://www.google.com/url?q=https%3A%2F%2Fexample.com%2Fdoc.pdf&sa=U';
      expect(normalizeUrl(googleRedirect)).toBe('https://example.com/doc.pdf');
    });

    it('normalizes protocol and strips www prefix', () => {
      const httpWww = 'http://www.example.com/page';
      const httpsPlain = 'https://example.com/page';
      expect(normalizeUrl(httpWww)).toBe('https://example.com/page');
      expect(normalizeUrl(httpsPlain)).toBe('https://example.com/page');
    });
  });

  describe('deduplicateResults', () => {
    it('removes duplicate URLs across different engines and merges engine tags', () => {
      const items = [
        { url: 'https://example.com/paper.pdf?utm_source=news', title: 'Paper', snippet: 'Short', engine: 'Google' },
        { url: 'https://example.com/paper.pdf', title: 'Paper - Full Research', snippet: 'Longer snippet description', engine: 'Bing' },
        { url: 'https://example.com/unique.pdf', title: 'Unique Doc', snippet: 'Unique snippet', engine: 'Google' }
      ];

      const deduped = deduplicateResults(items);
      expect(deduped).toHaveLength(2);
      expect(deduped[0].url).toBe('https://example.com/paper.pdf?utm_source=news');
      expect(deduped[0].engine).toContain('Google');
      expect(deduped[0].engine).toContain('Bing');
      expect(deduped[0].snippet).toBe('Longer snippet description');
      expect(deduped[0].hasAttachment).toBe(true);
      expect(deduped[1].url).toBe('https://example.com/unique.pdf');
    });

    it('deduplicates across engines when titles and domains match even with slightly different paths', () => {
      const items = [
        { url: 'https://www.example.com/docs/annual-report-2026/index.html', title: 'Annual Financial Report 2026', snippet: 'Overview', engine: 'Google' },
        { url: 'http://example.com/docs/annual-report-2026/', title: 'Annual Financial Report 2026', snippet: 'Full report overview', engine: 'Bing' }
      ];

      const deduped = deduplicateResults(items);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].engine).toContain('Google');
      expect(deduped[0].engine).toContain('Bing');
    });
  });
});
