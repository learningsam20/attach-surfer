import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkHardwareCapabilities } from './hardwareCheck';

describe('hardwareCheck', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns capable when device meets requirements', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 16,
      hardwareConcurrency: 8
    });

    const result = checkHardwareCapabilities();
    expect(result.isCapable).toBe(true);
    expect(result.memory).toBe(16);
    expect(result.cores).toBe(8);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns warning when RAM is below minimum', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 4,
      hardwareConcurrency: 8
    });

    const result = checkHardwareCapabilities();
    expect(result.isCapable).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('4GB RAM');
  });

  it('returns warning when CPU cores are below minimum', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 16,
      hardwareConcurrency: 2
    });

    const result = checkHardwareCapabilities();
    expect(result.isCapable).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('2 cores');
  });

  it('returns warning when both RAM and cores are below minimum', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 2,
      hardwareConcurrency: 1
    });

    const result = checkHardwareCapabilities();
    expect(result.isCapable).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('2GB RAM');
    expect(result.warnings[0]).toContain('1 cores');
  });

  it('uses defaults when navigator properties are undefined', () => {
    vi.stubGlobal('navigator', {});

    const result = checkHardwareCapabilities();
    expect(result.memory).toBe(4);
    expect(result.cores).toBe(4);
  });

  it('meets requirements at exact minimum thresholds', () => {
    vi.stubGlobal('navigator', {
      deviceMemory: 8,
      hardwareConcurrency: 4
    });

    const result = checkHardwareCapabilities();
    expect(result.isCapable).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
