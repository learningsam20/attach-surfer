import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAIModelConfig,
  generateGemmaCompletion,
  generateAICompletion,
  resetAIEngines
} from './aiEngine';

vi.mock('./webllmEngine', () => ({
  getWebLLMEngine: vi.fn().mockResolvedValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'WebLLM test completion' } }]
        })
      }
    }
  })
}));

describe('aiEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIEngines();
  });

  describe('getAIModelConfig', () => {
    it('returns default model configuration including localModelsPath', () => {
      const config = getAIModelConfig();
      expect(config).toHaveProperty('aiModel');
      expect(config).toHaveProperty('embeddingModel');
      expect(config).toHaveProperty('aiBackend');
      expect(config).toHaveProperty('localModelsPath');
      expect(config.localModelsPath).toBe('/models');
    });
  });

  describe('generateAICompletion', () => {
    it('calls WebLLM with resolved model and localModelsPath when aiModel is phi4', async () => {
      const { getWebLLMEngine } = await import('./webllmEngine');
      const response = await generateAICompletion({
        model: 'phi4',
        prompt: 'Explain local models',
        options: { localModelsPath: '/models' }
      });

      expect(getWebLLMEngine).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(String),
        expect.objectContaining({
          localModelsPath: '/models/phi4'
        })
      );
      expect(response).toBe('WebLLM test completion');
    });

    it('falls back to WebLLM Gemma when Transformers and LiteRT are not loaded', async () => {
      const { getWebLLMEngine } = await import('./webllmEngine');
      const response = await generateGemmaCompletion({
        prompt: 'Test gemma prompt',
        backend: 'auto',
        localModelsPath: '/models'
      });

      expect(getWebLLMEngine).toHaveBeenCalledWith(
        expect.any(Function),
        'gemma-2-2b-it-q4f16_1-MLC',
        expect.objectContaining({
          localModelsPath: '/models/gemma4'
        })
      );
      expect(response).toBe('WebLLM test completion');
    });
  });
});
