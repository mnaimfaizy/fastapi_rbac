import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DetailSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/common/Skeletons';

describe('Skeletons', () => {
  it('announces a loading table by name without visible loading text', () => {
    render(<TableSkeleton label="Loading users" rows={4} columns={3} />);

    const status = screen.getByRole('status', { name: 'Loading users' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('');
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('announces loading stat cards', () => {
    render(<StatCardsSkeleton label="Loading dashboard" />);

    expect(
      screen.getByRole('status', { name: 'Loading dashboard' })
    ).toBeInTheDocument();
  });

  it('announces a loading detail page', () => {
    render(<DetailSkeleton label="Loading user" />);

    expect(
      screen.getByRole('status', { name: 'Loading user' })
    ).toBeInTheDocument();
  });
});
