import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

describe('EmptyState', () => {
  it('names the empty space and invites the next action', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        icon={Shield}
        title="Create your first role"
        description="Roles bundle permissions so you can grant access in one step."
        action={{ label: 'Create role', onClick: onCreate }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Create your first role' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Roles bundle permissions so you can grant access in one step.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create role' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('offers no button when the viewer cannot act', () => {
    render(
      <EmptyState
        title="No role groups yet"
        description="An admin can create role groups. They’ll show up here."
      />
    );

    expect(
      screen.getByRole('heading', { name: 'No role groups yet' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('can link to another page instead of running a handler', () => {
    render(
      <MemoryRouter>
        <EmptyState
          title="No one holds this role yet"
          description="Assign it from a user’s page."
          action={{
            label: 'Go to users',
            href: '/users',
            variant: 'secondary',
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Go to users' })).toHaveAttribute(
      'href',
      '/users'
    );
  });
});
