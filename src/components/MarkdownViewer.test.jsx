import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownViewer from './MarkdownViewer';

describe('MarkdownViewer', () => {
  it('renders markdown headings and content', () => {
    const md = '# Main Document Title\n\nThis is paragraph content.';
    render(<MarkdownViewer content={md} title="Doc" />);

    expect(screen.getByText('Main Document Title')).toBeInTheDocument();
    expect(screen.getByText('This is paragraph content.')).toBeInTheDocument();
  });

  it('renders markdown tables properly', () => {
    const md = '| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |';
    render(<MarkdownViewer content={md} title="Table Doc" />);

    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();
    expect(screen.getByText('Value 2')).toBeInTheDocument();
  });

  it('calculates and shows word count statistics', () => {
    const md = 'Hello world this is a test document with several items.';
    render(<MarkdownViewer content={md} title="Stats Doc" />);

    expect(screen.getByText(/words \(/)).toBeInTheDocument();
    expect(screen.getByText(/min read/)).toBeInTheDocument();
  });

  it('handles copy button click', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });

    render(<MarkdownViewer content="# Copy Me" title="Copy Doc" />);
    const copyBtn = screen.getByTitle('Copy Markdown');
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('# Copy Me');
  });

  it('renders fallback when content is empty', () => {
    render(<MarkdownViewer content="" title="Empty" />);
    expect(screen.getByText('No document content available.')).toBeInTheDocument();
  });
});
