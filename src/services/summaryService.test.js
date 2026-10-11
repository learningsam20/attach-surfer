import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSummary } from './summaryService';

vi.mock('../utils/webllmEngine', () => ({
  getWebLLMEngine: vi.fn().mockResolvedValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test summary content' } }]
        })
      }
    }
  })
}));

vi.mock('../utils/aiEngine', () => ({
  generateGemmaCompletion: vi.fn().mockResolvedValue('Gemma 4 generated summary content'),
  getAIModelConfig: vi.fn().mockReturnValue({
    aiModel: 'phi4',
    embeddingModel: 'embeddinggemma2',
    aiBackend: 'auto',
    webllmModel: 'Phi-4-mini-instruct-q4f16_1-MLC',
    gemmaModel: 'gemma-4-E2B-it-web'
  })
}));

describe('summaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns message when no results provided', async () => {
    const result = await generateSummary([], {}, () => {});
    expect(result).toBe('No search results to summarize.');
  });

  it('returns message when results is null', async () => {
    const result = await generateSummary(null, {}, () => {});
    expect(result).toBe('No search results to summarize.');
  });

  it('generates summary from results and contents', async () => {
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2', engine: 'Google' }
    ];
    const contents = {
      'https://example.com/1': { success: true, markdown: 'Full content 1' },
      'https://example.com/2': { success: true, markdown: 'Full content 2' }
    };

    const result = await generateSummary(results, contents, () => {});
    expect(result).toBe('Test summary content');
  });

  it('uses snippet when content is not available', async () => {
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' }
    ];
    const contents = {};

    const result = await generateSummary(results, contents, () => {});
    expect(result).toBe('Test summary content');
  });

  it('uses snippet when content extraction failed', async () => {
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' }
    ];
    const contents = {
      'https://example.com/1': { success: false, markdown: 'Error' }
    };

    const result = await generateSummary(results, contents, () => {});
    expect(result).toBe('Test summary content');
  });

  it('calls onProgress callback', async () => {
    const onProgress = vi.fn();
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' }
    ];

    await generateSummary(results, {}, onProgress);
    expect(onProgress).toHaveBeenCalledWith('Generating summary with AI...');
  });

  it('throws error when engine fails', async () => {
    const { getWebLLMEngine } = await import('../utils/webllmEngine');
    getWebLLMEngine.mockRejectedValueOnce(new Error('Engine init failed'));

    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' }
    ];

    await expect(generateSummary(results, {}, () => {})).rejects.toThrow('Summary generation failed');
  });

  it('returns fallback message when response has no content', async () => {
    const { getWebLLMEngine } = await import('../utils/webllmEngine');
    getWebLLMEngine.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '' } }]
          })
        }
      }
    });

    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'Bing' }
    ];

    const result = await generateSummary(results, {}, () => {});
    expect(result).toBe('Unable to generate summary.');
  });

  it('routes to Gemma 4 when aiModel is gemma4', async () => {
    const { generateGemmaCompletion } = await import('../utils/aiEngine');
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'BrightData' }
    ];

    const result = await generateSummary(results, {}, () => {}, { aiModel: 'gemma4' });
    expect(generateGemmaCompletion).toHaveBeenCalled();
    expect(result).toBe('Gemma 4 generated summary content');
  });

  it('passes backend options to Gemma 4', async () => {
    const { generateGemmaCompletion } = await import('../utils/aiEngine');
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'BrightData' }
    ];

    await generateSummary(results, {}, () => {}, { aiModel: 'gemma4', aiBackend: 'litert-lm' });
    expect(generateGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: 'litert-lm'
      })
    );
  });

  it('passes localModelsPath options to Gemma 4', async () => {
    const { generateGemmaCompletion } = await import('../utils/aiEngine');
    const results = [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1', engine: 'BrightData' }
    ];

    await generateSummary(results, {}, () => {}, { aiModel: 'gemma4', localModelsPath: '/custom/models' });
    expect(generateGemmaCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        localModelsPath: '/custom/models'
      })
    );
  });

  describe('generateDocumentSummary', () => {
    it('returns fallback message when documentText is empty', async () => {
      const { generateDocumentSummary } = await import('./summaryService');
      const result = await generateDocumentSummary('', 'file.pdf');
      expect(result).toBe('No document content available to summarize.');
    });

    it('generates document summary using Gemma 4', async () => {
      const { generateDocumentSummary } = await import('./summaryService');
      const { generateGemmaCompletion } = await import('../utils/aiEngine');
      const onProgress = vi.fn();

      const result = await generateDocumentSummary(
        'This is the research report content.',
        'paper.pdf',
        onProgress,
        { aiModel: 'gemma4' }
      );

      expect(generateGemmaCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('paper.pdf'),
          systemPrompt: expect.stringContaining('expert document analyst')
        })
      );
      expect(result).toBe('Gemma 4 generated summary content');
      expect(onProgress).toHaveBeenCalledWith('Generating AI summary for document...');
    });

    it('generates document summary using WebLLM when aiModel is phi4', async () => {
      const { generateDocumentSummary } = await import('./summaryService');
      const result = await generateDocumentSummary(
        'Document content for phi4 test.',
        'doc.txt',
        vi.fn(),
        { aiModel: 'phi4' }
      );
      expect(result).toBe('Test summary content');
    });

    it('throws error when document summary generation fails', async () => {
      const { generateDocumentSummary } = await import('./summaryService');
      const { generateGemmaCompletion } = await import('../utils/aiEngine');
      generateGemmaCompletion.mockRejectedValueOnce(new Error('Gemma OOM'));

      await expect(
        generateDocumentSummary('Some text', 'doc.pdf', vi.fn(), { aiModel: 'gemma4' })
      ).rejects.toThrow('Document summary generation failed: Gemma OOM');
    });

    it('chunks large documents and performs hierarchical synthesis', async () => {
      const { generateDocumentSummary, chunkDocumentText } = await import('./summaryService');
      const { generateGemmaCompletion } = await import('../utils/aiEngine');
      generateGemmaCompletion.mockResolvedValue('Synthesized Executive Summary');

      const largeText = Array(400).fill('### Page Section\n\nThis is long research text content with data and evidence.').join('\n\n');
      expect(largeText.length).toBeGreaterThan(15000);
      const chunks = chunkDocumentText(largeText);
      expect(chunks.length).toBeGreaterThan(1);

      const onProgress = vi.fn();
      const summary = await generateDocumentSummary(largeText, 'big_report.pdf', onProgress, { aiModel: 'gemma4' });

      expect(summary).toBe('Synthesized Executive Summary');
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Processing large document'));
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Synthesizing final executive summary'));
    });
  });

  describe('Long-context and Recursive Summarization', () => {
    it('estimates token count accurately', async () => {
      const { estimateTokenCount } = await import('./summaryService');
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('a'.repeat(350))).toBe(100);
    });

    it('prepares high-signal extracts for very large results', async () => {
      const { prepareResultExtract } = await import('./summaryService');
      const longMarkdown = '# Heading\n' + 'Paragraph text content. '.repeat(500) + '\n\n**Conclusion:** Final takeaways.';
      const extract = prepareResultExtract(
        { title: 'Big Paper', url: 'https://ibm.com/paper.pdf', engine: 'Bing' },
        { success: true, markdown: longMarkdown }
      );

      expect(extract.length).toBeLessThan(3000);
      expect(extract).toContain('Big Paper');
      expect(extract).toContain('Source:');
    });

    it('processes massive search results with hierarchical map-reduce and recursive batching', async () => {
      const { generateSummary } = await import('./summaryService');
      const { generateGemmaCompletion } = await import('../utils/aiEngine');
      generateGemmaCompletion.mockResolvedValue('Combined synthesized summary');

      // Create 8 results each with 3,000 characters (total > 24,000 characters, exceeds single pass limit)
      const results = Array.from({ length: 8 }, (_, i) => ({
        title: `Research Report ${i + 1}`,
        url: `https://example.com/doc_${i + 1}.pdf`,
        engine: 'All',
        snippet: 'Snippet ' + i
      }));

      const contents = {};
      results.forEach(r => {
        contents[r.url] = {
          success: true,
          markdown: (`### Report ${r.title}\n\n` + 'Detailed findings and evidence data. '.repeat(80))
        };
      });

      const onProgress = vi.fn();
      const summary = await generateSummary(results, contents, onProgress, { aiModel: 'gemma4' });

      expect(summary).toBe('Combined synthesized summary');
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Processing large result set'));
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Synthesizing comprehensive summary across all sources'));
    });
  });
});



