import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { queryShellSidebar, renderAppAt } from './system-states-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
// The refused pages never render, but the routes import them.
vi.mock('../services/role.service');
vi.mock('../services/user.service');
vi.mock('../services/permission.service');

/** The Unauthorized body: the sentence naming the missing permission. */
function explanation() {
  return screen.getByText(/^You need/);
}

describe('In-app Unauthorized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('tells a manager which permission editing a role needs, inside the shell', async () => {
    renderAppAt('/dashboard/roles/edit/7', 'manager');

    expect(
      await screen.findByRole('heading', { name: 'You can’t edit roles' })
    ).toBeInTheDocument();
    expect(explanation()).toHaveTextContent(
      'You need role.update to edit roles. Ask an admin to add it to one of your roles.'
    );
    expect(within(explanation()).getByText('role.update').tagName).toBe('CODE');
    expect(queryShellSidebar()).toBeInTheDocument();
    // The manager can read roles, so the way out is the roles list.
    expect(screen.getByRole('link', { name: 'Back to roles' })).toHaveAttribute(
      'href',
      '/dashboard/roles'
    );
    // The route guard's old bare message is gone.
    expect(
      screen.queryByText('You don’t have permission to access this page.')
    ).not.toBeInTheDocument();
  });

  it('shows the edit step in the breadcrumb', async () => {
    renderAppAt('/dashboard/roles/edit/7', 'manager');

    const breadcrumb = await screen.findByRole('navigation', {
      name: 'Breadcrumb',
    });
    expect(breadcrumb).toHaveTextContent('Access');
    expect(
      within(breadcrumb).getByRole('link', { name: 'Roles' })
    ).toBeVisible();
    expect(within(breadcrumb).getByText('Edit')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('tells an admin which permission creating a permission needs', async () => {
    renderAppAt('/dashboard/permissions/new', 'admin');

    expect(
      await screen.findByRole('heading', {
        name: 'You can’t create permissions',
      })
    ).toBeInTheDocument();
    expect(explanation()).toHaveTextContent(
      'You need permission.create to create permissions.'
    );
    expect(queryShellSidebar()).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to permissions' })
    ).toHaveAttribute('href', '/dashboard/permissions');
  });

  it('sends a plain user home from a list they cannot view', async () => {
    renderAppAt('/dashboard/users', 'user');

    expect(
      await screen.findByRole('heading', { name: 'You can’t view users' })
    ).toBeInTheDocument();
    expect(explanation()).toHaveTextContent(
      'You need user.read to view users.'
    );
    expect(queryShellSidebar()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(
      screen.queryByRole('link', { name: 'Back to users' })
    ).not.toBeInTheDocument();
  });

  it('names the permission for a page under a list the viewer cannot read', async () => {
    renderAppAt('/dashboard/role-groups/new', 'user');

    expect(
      await screen.findByRole('heading', {
        name: 'You can’t create role groups',
      })
    ).toBeInTheDocument();
    expect(explanation()).toHaveTextContent(
      'You need role_group.create to create role groups.'
    );
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeVisible();
  });

  it('shows /unauthorized inside the shell for a signed-in user', async () => {
    renderAppAt('/unauthorized', 'manager');

    expect(
      await screen.findByRole('heading', { name: 'You can’t open this page' })
    ).toBeInTheDocument();
    expect(queryShellSidebar()).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to dashboard' })
    ).toHaveAttribute('href', '/dashboard');
  });
});
