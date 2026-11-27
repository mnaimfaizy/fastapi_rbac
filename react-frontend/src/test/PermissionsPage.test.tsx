import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import PermissionsContent from '@/features/permissions/PermissionsContent';
import permissionService from '@/services/permission.service';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';

vi.mock('@/services/permission.service');
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockPermissionService = vi.mocked(permissionService);

const permissions = [
  {
    id: '1',
    name: 'user.create',
    description: 'Create users',
    group: {
      id: 'g-user',
      name: 'User',
      created_at: '2026-01-12T00:00:00Z',
      updated_at: '2026-01-12T00:00:00Z',
    },
    created_at: '2026-01-12T00:00:00Z',
    updated_at: '2026-01-12T00:00:00Z',
  },
  {
    id: '2',
    name: 'role.read',
    description: 'View roles',
    group: {
      id: 'g-role',
      name: 'Role',
      created_at: '2026-01-12T00:00:00Z',
      updated_at: '2026-01-12T00:00:00Z',
    },
    created_at: '2026-01-12T00:00:00Z',
    updated_at: '2026-01-12T00:00:00Z',
  },
];

function page(items: typeof permissions) {
  return {
    data: {
      items,
      total: items.length,
      page: 1,
      size: 100,
      pages: 1,
      next_page: null,
      previous_page: null,
    },
    message: '',
    meta: {},
  };
}

function viewerState(role: 'admin' | 'manager' | 'user') {
  const state = signedInAs(role);
  const user = state.auth.user;
  if (!user) {
    return state;
  }
  const extra =
    role === 'admin' ? ['permission.create', 'permission.delete'] : [];
  return {
    auth: {
      ...state.auth,
      user: { ...user, permissions: [...user.permissions, ...extra] },
    },
  };
}

describe('Permissions list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionService.getPermissions.mockResolvedValue(page(permissions));
    mockPermissionService.deletePermission.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('filters the list by permission group for an admin', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionsContent />, {
      preloadedState: viewerState('admin'),
    });

    expect(
      await screen.findByRole('link', { name: 'user.create' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'role.read' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Permissions' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('The individual actions a role can grant.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create permission' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Showing 1–2 of 2 permissions')
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by group' }),
      'Role'
    );

    expect(
      screen.queryByRole('link', { name: 'user.create' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'role.read' })).toBeInTheDocument();
    expect(
      screen.getByText('Showing 1–1 of 1 permissions')
    ).toBeInTheDocument();
  });

  it('opens detail from the code and deletes from the actions menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PermissionsContent />, {
      preloadedState: viewerState('admin'),
    });

    await user.click(await screen.findByRole('link', { name: 'user.create' }));
    expect(window.location.pathname).toBe('/dashboard/permissions/1');

    window.history.pushState({}, '', '/');
    await user.click(
      screen.getByRole('button', { name: 'Actions for user.create' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete permission' }));

    expect(mockPermissionService.deletePermission).toHaveBeenCalledWith('1');
    expect(toast.success).toHaveBeenCalledWith('Permission deleted');
  });

  it('shows the catalog to a manager without create or delete', async () => {
    renderWithProviders(<PermissionsContent />, {
      preloadedState: viewerState('manager'),
    });

    expect(
      await screen.findByRole('link', { name: 'user.create' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'role.read' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create permission' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Actions for/ })
    ).not.toBeInTheDocument();
  });

  it('tells a plain user they cannot view permissions', async () => {
    renderWithProviders(<PermissionsContent />, {
      preloadedState: viewerState('user'),
    });

    expect(
      await screen.findByText('You do not have permission to view permissions.')
    ).toBeInTheDocument();
    expect(mockPermissionService.getPermissions).not.toHaveBeenCalled();
  });
});
