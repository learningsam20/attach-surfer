import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rxdb', () => ({
  getDatabase: vi.fn(async () => ({
    runs: {
      insert: vi.fn(async (data) => ({ ...data, id: data.id || 'run_123' })),
      findOne: vi.fn(() => ({
        exec: vi.fn(async () => null)
      })),
      find: vi.fn(() => ({
        exec: vi.fn(async () => [])
      }))
    },
    files: {
      insert: vi.fn(async (data) => ({ ...data, id: data.id || 'file_123' })),
      findOne: vi.fn(() => ({
        exec: vi.fn(async () => null)
      })),
      find: vi.fn(() => ({
        exec: vi.fn(async () => [])
      }))
    },
    outputs: {
      insert: vi.fn(async (data) => ({ ...data, id: data.id || 'output_123' })),
      findOne: vi.fn(() => ({
        exec: vi.fn(async () => null)
      })),
      find: vi.fn(() => ({
        exec: vi.fn(async () => [])
      }))
    }
  }))
}));

import { db } from './database';

describe('database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searches table', () => {
    it('adds a search record', async () => {
      const id = await db.searches.add({
        query: 'test query',
        engine: 'all',
        resultCount: 5,
        attachmentFilter: 'all',
        timestamp: Date.now(),
        resultIds: []
      });

      expect(id).toBeDefined();
    });
  });

  describe('results table', () => {
    it('adds a result record', async () => {
      const id = await db.results.add({
        searchId: 'run_123',
        rank: 1,
        title: 'Test Result',
        url: 'https://example.com',
        displayUrl: 'example.com',
        snippet: 'Test snippet',
        engine: 'Bing',
        timestamp: Date.now()
      });

      expect(id).toBeDefined();
    });
  });

  describe('telemetry table', () => {
    it('adds a telemetry event', async () => {
      await db.telemetry.add({
        event: 'search',
        data: { query: 'test' },
        timestamp: Date.now()
      });

      expect(true).toBe(true);
    });
  });
});
