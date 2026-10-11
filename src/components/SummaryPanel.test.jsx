import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummaryPanel from './SummaryPanel';

describe('SummaryPanel', () => {
  it('renders nothing when no summary, not generating, and no error', () => {
    const { container } = render(
      <SummaryPanel summary={null} isGenerating={false} error={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders summary content', () => {
    render(
      <SummaryPanel summary="Test summary content" isGenerating={false} error={null} />
    );
    expect(screen.getByText('Test summary content')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(
      <SummaryPanel summary={null} isGenerating={false} error="Something went wrong" />
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders generating indicator', () => {
    render(
      <SummaryPanel summary={null} isGenerating={true} error={null} />
    );
    expect(screen.getByText(/Generating summary using AI/i)).toBeInTheDocument();
  });

  it('renders both summary and error', () => {
    render(
      <SummaryPanel summary="Summary" isGenerating={false} error="Error msg" />
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Error msg')).toBeInTheDocument();
  });

  it('renders AI-Generated Summary header', () => {
    render(
      <SummaryPanel summary="Test" isGenerating={false} error={null} />
    );
    expect(screen.getByText('AI-Generated Summary')).toBeInTheDocument();
  });

  it('collapses and expands summary when clicking toggle button', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <SummaryPanel summary="Detailed collapsible content" isGenerating={false} error={null} />
    );
    expect(screen.getByText('Detailed collapsible content')).toBeInTheDocument();

    const collapseBtn = screen.getByRole('button', { name: /collapse summary/i });
    fireEvent.click(collapseBtn);

    expect(screen.queryByText('Detailed collapsible content')).not.toBeInTheDocument();
    expect(screen.getByText('Collapsed')).toBeInTheDocument();

    const expandBtn = screen.getByRole('button', { name: /expand summary/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText('Detailed collapsible content')).toBeInTheDocument();
  });
});
