import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HardwareWarning from './HardwareWarning';

describe('HardwareWarning', () => {
  it('renders nothing when warnings array is empty', () => {
    const { container } = render(<HardwareWarning warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when warnings is null', () => {
    const { container } = render(<HardwareWarning warnings={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders warning message', () => {
    render(<HardwareWarning warnings={['Your device has 4GB RAM']} />);
    expect(screen.getByText('Hardware Limitation Detected')).toBeInTheDocument();
    expect(screen.getByText('Your device has 4GB RAM')).toBeInTheDocument();
  });

  it('renders multiple warnings', () => {
    render(<HardwareWarning warnings={['Warning 1', 'Warning 2']} />);
    expect(screen.getByText('Warning 1')).toBeInTheDocument();
    expect(screen.getByText('Warning 2')).toBeInTheDocument();
  });
});
