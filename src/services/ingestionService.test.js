import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/rxdb', () => ({
  ensureUser: vi.fn().mockResolvedValue({ id: 'default' }),
  createRun: vi.fn().mockResolvedValue({ id: 'run_123' }),
  updateRun: vi.fn().mockResolvedValue({}),
  addFile: vi.fn().mockResolvedValue({ id: 'file_123' }),
  updateFile: vi.fn().mockResolvedValue({}),
  addOutput: vi.fn().mockResolvedValue({ id: 'output_123' }),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(128).fill(0.1)),
  searchFiles: vi.fn().mockResolvedValue([]),
  searchOutputs: vi.fn().mockResolvedValue([]),
  getRunFiles: vi.fn().mockResolvedValue([]),
  getRunOutputs: vi.fn().mockResolvedValue([])
}));

vi.mock('./attachmentExtractor', () => ({
  extractText: vi.fn().mockResolvedValue('Extracted text content'),
  pdfToImages: vi.fn().mockResolvedValue([])
}));

vi.mock('./ocrService', () => ({
  performOCR: vi.fn().mockResolvedValue('OCR text content')
}));

vi.mock('./htmlConverter', () => ({
  convertHtmlToMarkdown: vi.fn().mockReturnValue({ title: 'Test', markdown: 'Test content' })
}));

import { ingestUrl, ingestMultipleUrls, searchIngestedContent, saveSummary } from './ingestionService';

describe('ingestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ingestUrl', () => {
    it('ingests a web page', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body><h1>Test</h1></body></html>')
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await ingestUrl('https://example.com', 'run_123', () => {});
      expect(result.type).toBe('page');
      expect(result.file).toBeDefined();
    });

    it('handles fetch errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(ingestUrl('https://example.com', 'run_123', () => {}))
        .rejects.toThrow('Network error');
    });
  });

  describe('ingestMultipleUrls', () => {
    it('ingests multiple URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<html><body>Test</body></html>')
      });
      vi.stubGlobal('fetch', mockFetch);

      const urls = ['https://example.com/1', 'https://example.com/2'];
      const result = await ingestMultipleUrls(urls, 'test query', 'all', () => {});

      expect(result.runId).toBe('run_123');
      expect(result.results).toHaveLength(2);
    });
  });

  describe('searchIngestedContent', () => {
    it('returns search results', async () => {
      const { searchFiles, searchOutputs } = await import('../db/rxdb');
      searchFiles.mockResolvedValueOnce([
        { id: 'file_1', url: 'https://example.com', filename: 'test.pdf', type: 'attachment', content: 'Test content', score: 0.9 }
      ]);
      searchOutputs.mockResolvedValueOnce([
        { id: 'output_1', type: 'summary', content: 'Test summary', score: 0.8 }
      ]);

      const results = await searchIngestedContent('test query');
      expect(results.files).toHaveLength(1);
      expect(results.outputs).toHaveLength(1);
    });
  });

  describe('saveSummary', () => {
    it('saves a summary', async () => {
      const result = await saveSummary('run_123', 'Test summary');
      expect(result.id).toBe('output_123');
    });
  });
});
