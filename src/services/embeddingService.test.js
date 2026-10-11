import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateHashEmbedding,
  cosineSimilarity,
  generateEmbedding,
  getEmbeddingModelName,
  getLocalModelsPath,
  resetEmbeddingPipeline
} from './embeddingService';

describe('embeddingService', () => {
  beforeEach(() => {
    resetEmbeddingPipeline();
  });

  describe('generateHashEmbedding', () => {
    it('generates a normalized vector of default length 128', () => {
      const vec = generateHashEmbedding('search engine query for attachments');
      expect(vec).toHaveLength(128);
      // Normalized vector should have norm close to 1
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 4);
    });

    it('handles custom dimension (e.g. 768)', () => {
      const vec = generateHashEmbedding('test text', 768);
      expect(vec).toHaveLength(768);
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 4);
    });

    it('returns zero vector for empty or invalid input', () => {
      const emptyVec = generateHashEmbedding('');
      expect(emptyVec).toHaveLength(128);
      expect(emptyVec.every(v => v === 0)).toBe(true);

      const nullVec = generateHashEmbedding(null);
      expect(nullVec.every(v => v === 0)).toBe(true);
    });

    it('generates identical embeddings for identical text', () => {
      const vec1 = generateHashEmbedding('machine learning on client devices');
      const vec2 = generateHashEmbedding('machine learning on client devices');
      expect(vec1).toEqual(vec2);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const v = generateHashEmbedding('hello world');
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 4);
    });

    it('returns high similarity for similar texts', () => {
      const v1 = generateHashEmbedding('deep learning neural network');
      const v2 = generateHashEmbedding('deep learning artificial intelligence neural');
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeGreaterThan(0.5);
    });

    it('returns lower similarity for completely unrelated texts', () => {
      const v1 = generateHashEmbedding('banana orange apple fruit');
      const v2 = generateHashEmbedding('quantum physics relativity particle');
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeLessThan(0.3);
    });

    it('returns 0 for mismatched vector lengths or null vectors', () => {
      expect(cosineSimilarity(null, [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('generateEmbedding', () => {
    it('generates 128-dim embedding when hash model selected', async () => {
      const emb = await generateEmbedding('hello world', { model: 'hash' });
      expect(emb).toHaveLength(128);
    });

    it('generates 768-dim embedding for embeddinggemma2 in fallback environment', async () => {
      const emb = await generateEmbedding('hello world', { model: 'embeddinggemma2' });
      expect(emb).toHaveLength(768);
      const norm = Math.sqrt(emb.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 4);
    });

    it('respects getEmbeddingModelName default', () => {
      const defaultModel = getEmbeddingModelName();
      expect(['embeddinggemma2', 'hash']).toContain(defaultModel);
    });

    it('returns configured or default localModelsPath', () => {
      const localPath = getLocalModelsPath();
      expect(localPath).toBe('/models');
    });

    it('accepts custom localModelsPath option in generateEmbedding', async () => {
      const emb = await generateEmbedding('test vector', { model: 'embeddinggemma2', localModelsPath: '/custom/models' });
      expect(emb).toHaveLength(768);
    });
  });
});
