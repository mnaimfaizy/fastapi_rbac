import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';

describe('PageHeader', () => {
  it('shows the page title as the top-level heading with its description', () => {
    render(
      <PageHeader
        title="Users"
        description="Everyone who can sign in, and what they can do."
      />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Users' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Everyone who can sign in, and what they can do.')
    ).toBeInTheDocument();
  });

  it('shows its one primary action', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <PageHeader
        title="Users"
        action={<Button onClick={onAdd}>Add user</Button>}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add user' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders no action area when the viewer has nothing to do', () => {
    render(<PageHeader title="Roles" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Roles' })).toBeInTheDocument();
  });
});
