import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
  it('renders search input', () => {
    render(<SearchBar onSearch={() => {}} isSearching={false} />);
    expect(screen.getByPlaceholderText('Enter your search query...')).toBeInTheDocument();
  });

  it('renders search button', () => {
    render(<SearchBar onSearch={() => {}} isSearching={false} />);
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('renders engine selector', () => {
    render(<SearchBar onSearch={() => {}} isSearching={false} />);
    expect(screen.getByText('All (Google + Bing + BrightData)')).toBeInTheDocument();
  });

  it('renders attachment filter options', () => {
    render(<SearchBar onSearch={() => {}} isSearching={false} />);
    expect(screen.getByText("Don't filter")).toBeInTheDocument();
    expect(screen.getByText('With attachments only')).toBeInTheDocument();
    expect(screen.getByText('Without attachments')).toBeInTheDocument();
  });

  it('calls onSearch with form data when submitted', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} />);

    const input = screen.getByPlaceholderText('Enter your search query...');
    await userEvent.type(input, 'test query');

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(onSearch).toHaveBeenCalledWith({
      query: 'test query',
      engine: 'all',
      attachmentFilter: 'with',
      resultCount: 3
    });
  });

  it('does not call onSearch when query is empty', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} />);

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('disables search button when searching', () => {
    render(<SearchBar onSearch={() => {}} isSearching={true} />);
    expect(screen.getByRole('button', { name: /searching/i })).toBeDisabled();
  });

  it('updates engine selection', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} />);

    const input = screen.getByPlaceholderText('Enter your search query...');
    await userEvent.type(input, 'test');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'bing' } });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ engine: 'bing' }));
  });

  it('updates brightdata engine selection', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} />);

    const input = screen.getByPlaceholderText('Enter your search query...');
    await userEvent.type(input, 'test');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'brightdata' } });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ engine: 'brightdata' }));
  });

  it('updates result count', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} />);

    const input = screen.getByPlaceholderText('Enter your search query...');
    await userEvent.type(input, 'test');

    const countSelect = screen.getByDisplayValue('3');
    fireEvent.change(countSelect, { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ resultCount: 5 }));
  });

  it('respects defaultAttachmentFilter prop', async () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} isSearching={false} defaultAttachmentFilter="with" />);

    const input = screen.getByPlaceholderText('Enter your search query...');
    await userEvent.type(input, 'test');

    fireEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ attachmentFilter: 'with' }));
  });
});
