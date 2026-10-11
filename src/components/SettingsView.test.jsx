import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SettingsView from './SettingsView';

describe('SettingsView', () => {
  const mockConfig = {
    defaultEngine: 'brightdata',
    resultCount: 5,
    brightDataApiKey: 'test-key',
    brightDataZone: 'serp_api1',
    googleApiKey: 'g-key',
    googleCx: 'g-cx',
    bingApiKey: 'b-key',
    aiModel: 'gemma4',
    embeddingModel: 'embeddinggemma2',
    aiBackend: 'auto',
    webllmModel: 'Phi-4-mini-instruct-q4f16_1-MLC',
    gemmaModel: 'gemma-4-E2B-it-web',
    localModelsPath: '/models',
    storeHistory: true,
    telemetryEnabled: false
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders settings inputs with provided config values', () => {
    render(<SettingsView config={mockConfig} onUpdateConfig={() => {}} />);
    expect(screen.getByDisplayValue('Bright Data')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-key')).toBeInTheDocument();
  });

  it('calls onUpdateConfig with modified values when Save is clicked', () => {
    const onUpdateConfig = vi.fn();
    render(<SettingsView config={mockConfig} onUpdateConfig={onUpdateConfig} />);

    // Change result count
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '10' } });

    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    expect(onUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        resultCount: 10,
        defaultEngine: 'brightdata'
      })
    );
  });

  it('resets to defaults when Reset to Defaults is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        defaultEngine: 'all',
        resultCount: 3,
        brightDataApiKey: '',
        aiModel: 'phi4'
      })
    });

    const onUpdateConfig = vi.fn();
    render(<SettingsView config={mockConfig} onUpdateConfig={onUpdateConfig} />);

    const resetBtn = screen.getByRole('button', { name: /reset to defaults/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    expect(onUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        resultCount: 3,
        defaultEngine: 'all'
      })
    );
  });
});
