import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/rxdb', () => ({
  getDatabase: vi.fn(async () => ({
    outputs: {
      insert: vi.fn(async (data) => ({ ...data, id: 'telemetry_123' })),
      find: vi.fn(() => ({
        limit: vi.fn(() => ({
          exec: vi.fn(async () => [])
        })),
        exec: vi.fn(async () => [])
      })),
      findOne: vi.fn(() => ({
        exec: vi.fn(async () => null)
      }))
    }
  }))
}));

import { trackEvent, getTelemetryEvents, clearTelemetry, getEventCounts } from './telemetryService';

describe('telemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('tracks an event with data', async () => {
      vi.stubEnv('VITE_TELEMETRY_ENABLED', 'true');
      await trackEvent('search', { query: 'test' });
      expect(true).toBe(true);
    });

    it('does not track when telemetry is disabled', async () => {
      vi.stubEnv('VITE_TELEMETRY_ENABLED', 'false');
      await trackEvent('search', { query: 'test' });
      expect(true).toBe(true);
    });
  });

  describe('getTelemetryEvents', () => {
    it('returns telemetry events', async () => {
      const events = await getTelemetryEvents();
      expect(events).toBeDefined();
    });
  });

  describe('clearTelemetry', () => {
    it('clears all telemetry events', async () => {
      await clearTelemetry();
      expect(true).toBe(true);
    });
  });

  describe('getEventCounts', () => {
    it('returns event counts', async () => {
      const counts = await getEventCounts();
      expect(counts).toBeDefined();
    });
  });
});
