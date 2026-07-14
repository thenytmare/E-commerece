import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Buy now</Button>);
    expect(screen.getByRole('button', { name: 'Buy now' })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button', { name: /submit/i })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });
});
