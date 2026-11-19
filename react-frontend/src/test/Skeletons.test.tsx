import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DetailSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/common/Skeletons';

describe('Skeletons', () => {
  it('announces a loading table and shows only placeholders', () => {
    render(<TableSkeleton label="Loading users" rows={4} columns={3} />);

    const status = screen.getByRole('status', { name: 'Loading users' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    // The label is the region's only text, so a screen reader announces
    // it. It is visually hidden: the placeholders carry no other text.
    expect(status).toHaveTextContent(/^Loading users$/);
    expect(screen.getAllByText('Loading users')).toHaveLength(1);
  });

  it('announces loading stat cards', () => {
    render(<StatCardsSkeleton label="Loading dashboard" />);

    expect(
      screen.getByRole('status', { name: 'Loading dashboard' })
    ).toHaveTextContent(/^Loading dashboard$/);
  });

  it('announces a loading detail page', () => {
    render(<DetailSkeleton label="Loading user" />);

    expect(
      screen.getByRole('status', { name: 'Loading user' })
    ).toHaveTextContent(/^Loading user$/);
  });
});
