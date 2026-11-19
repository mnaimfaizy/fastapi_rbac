import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/common/StatusBadge';

function iconOf(label: string) {
  return screen.getByText(label).querySelector('svg');
}

describe('StatusBadge', () => {
  it.each([
    ['locked', 'Locked'],
    ['expiring', 'Expiring'],
    ['pending', 'Pending'],
    ['disabled', 'Disabled'],
  ] as const)(
    'shows the %s exception with its label and an icon',
    (status, label) => {
      render(<StatusBadge status={status} />);

      expect(screen.getByText(label)).toBeInTheDocument();
      const icon = iconOf(label);
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  );

  it.each([
    ['active', 'Active'],
    ['verified', 'Verified'],
  ] as const)(
    'shows the healthy %s state as a plain label',
    (status, label) => {
      render(<StatusBadge status={status} />);

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(iconOf(label)).toBeNull();
    }
  );

  it('gives each exception a different icon from the healthy states', () => {
    render(
      <>
        <StatusBadge status="locked" />
        <StatusBadge status="expiring" />
      </>
    );

    expect(iconOf('Locked')?.innerHTML).not.toBe(iconOf('Expiring')?.innerHTML);
  });

  it('uses the glossary labels, not the artboard wording', () => {
    render(
      <>
        <StatusBadge status="pending" />
        <StatusBadge status="disabled" />
      </>
    );

    expect(screen.queryByText('Unverified')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('shows a longer description on hover', () => {
    render(<StatusBadge status="locked" description="Locked until 14:05" />);

    expect(screen.getByText('Locked')).toHaveAttribute(
      'title',
      'Locked until 14:05'
    );
  });
});
