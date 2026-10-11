import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultCard from './ResultCard';

const mockResult = {
  title: 'Test Result',
  url: 'https://example.com/page',
  displayUrl: 'example.com',
  snippet: 'Test snippet',
  engine: 'Bing'
};

describe('ResultCard', () => {
  it('renders result title', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('Test Result')).toBeInTheDocument();
  });

  it('renders result URL', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('renders snippet', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('Test snippet')).toBeInTheDocument();
  });

  it('renders engine badge', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('Bing')).toBeInTheDocument();
  });

  it('renders rank number', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders attachment badge when hasAttachment is true', () => {
    render(
      <ResultCard
        result={{ ...mockResult, hasAttachment: true }}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('Attachment')).toBeInTheDocument();
  });

  it('does not render attachment badge when hasAttachment is false', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.queryByText('Attachment')).not.toBeInTheDocument();
  });

  it('calls onToggleContent when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={null}
        onToggleContent={onToggle}
        isExpanded={false}
      />
    );

    fireEvent.click(screen.getByText(/Extract Page Content/i));
    expect(onToggle).toHaveBeenCalledWith('https://example.com/page');
  });

  it('shows "View Extracted Content" when content is available', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={{ success: true, markdown: 'Content' }}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText(/View Extracted Content/i)).toBeInTheDocument();
  });

  it('shows "Hide Content" when expanded', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={{ success: true, markdown: 'Content' }}
        onToggleContent={() => {}}
        isExpanded={true}
      />
    );
    expect(screen.getByText(/Hide Content/i)).toBeInTheDocument();
  });

  it('renders expanded content when isExpanded is true', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={{ success: true, markdown: 'Extracted markdown content' }}
        onToggleContent={() => {}}
        isExpanded={true}
      />
    );
    expect(screen.getByText('Extracted markdown content')).toBeInTheDocument();
  });

  it('renders title from content when available', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={{ success: true, title: 'Page Title', markdown: 'Content' }}
        onToggleContent={() => {}}
        isExpanded={true}
      />
    );
    expect(screen.getByText('Page Title')).toBeInTheDocument();
  });

  it('shows loading state when content is loading', () => {
    render(
      <ResultCard
        result={mockResult}
        index={0}
        content={{ loading: true }}
        onToggleContent={() => {}}
        isExpanded={true}
      />
    );
    expect(screen.getByText(/Extracting content.../i)).toBeInTheDocument();
  });

  it('uses URL when displayUrl is not available', () => {
    render(
      <ResultCard
        result={{ ...mockResult, displayUrl: '' }}
        index={0}
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );
    expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
  });

  it('highlights matched query terms in title and snippet', () => {
    const { container } = render(
      <ResultCard
        result={{
          title: 'Discover WebLLM Machine Learning',
          url: 'https://example.com/webllm',
          displayUrl: 'example.com',
          snippet: 'WebLLM allows fast in-browser inference for modern models.',
          engine: 'DuckDuckGo'
        }}
        index={0}
        query="WebLLM models"
        content={null}
        onToggleContent={() => {}}
        isExpanded={false}
      />
    );

    const highlights = container.querySelectorAll('mark.search-highlight');
    expect(highlights.length).toBeGreaterThanOrEqual(3);
    const highlightedTexts = Array.from(highlights).map(h => h.textContent.toLowerCase());
    expect(highlightedTexts).toContain('webllm');
    expect(highlightedTexts).toContain('models');
  });
});
