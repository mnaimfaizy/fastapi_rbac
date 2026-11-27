import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import PermissionDetail from '@/features/permissions/PermissionDetail';
import permissionService from '@/services/permission.service';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';

vi.mock('@/services/permission.service');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockPermissionService = vi.mocked(permissionService);

const permission = {
  id: 'perm-1',
  name: 'user.update',
  description: 'Edit users',
  group: {
    id: 'g-user',
    name: 'User',
    created_at: '2026-01-12T00:00:00Z',
    updated_at: '2026-01-12T00:00:00Z',
  },
  created_at: '2026-01-12T00:00:00Z',
  updated_at: '2026-01-12T00:00:00Z',
  roles: [
    {
      id: 'role-admin',
      name: 'Admin',
      role_group: 'Administrative',
      user_count: 3,
    },
    {
      id: 'role-manager',
      name: 'Manager',
      role_group: 'Operational',
      user_count: 8,
    },
  ],
};

function viewerState(role: 'admin' | 'manager' | 'user') {
  const state = signedInAs(role);
  const user = state.auth.user;
  if (!user) {
    return state;
  }
  const extra = role === 'admin' ? ['permission.delete'] : [];
  return {
    auth: {
      ...state.auth,
      user: { ...user, permissions: [...user.permissions, ...extra] },
    },
  };
}

function renderDetail(role: 'admin' | 'manager' | 'user') {
  window.history.pushState({}, '', '/dashboard/permissions/perm-1');
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard/permissions/:id" element={<PermissionDetail />} />
      <Route
        path="/dashboard/permissions"
        element={<h1>Permissions list</h1>}
      />
    </Routes>,
    { preloadedState: viewerState(role) }
  );
}

describe('Permission detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Drop any queued once-values so one test's failures cannot leak into the next.
    mockPermissionService.getPermissionById.mockReset();
    mockPermissionService.getPermissionById.mockResolvedValue({
      data: permission,
      message: '',
      meta: {},
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('lists every role that grants the permission for an admin', async () => {
    renderDetail('admin');

    expect(
      await screen.findByRole('heading', { name: 'user.update' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Edit users')).toHaveLength(2);
    expect(screen.getByText('12 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('perm-1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Roles that grant this permission' })
    ).toBeInTheDocument();
    expect(screen.getByText('2 roles · 11 users')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Admin' })).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'Administrative' })
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Manager' })).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'Operational' })
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '8' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'More actions' })
    ).toBeInTheDocument();
    expect(mockPermissionService.getPermissionById).toHaveBeenCalledWith(
      'perm-1'
    );
  });

  it('shows the same roles to a manager, without delete', async () => {
    renderDetail('manager');

    expect(await screen.findByText('2 roles · 11 users')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Manager' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'More actions' })
    ).not.toBeInTheDocument();
  });

  it('tells a plain user they cannot view the permission', async () => {
    renderDetail('user');

    expect(
      await screen.findByText('You do not have permission to view permissions.')
    ).toBeInTheDocument();
    expect(mockPermissionService.getPermissionById).not.toHaveBeenCalled();
  });
  it('says the permission is not found only for a 404', async () => {
    mockPermissionService.getPermissionById.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { detail: 'Permission not found' } },
    });
    renderDetail('admin');

    expect(
      await screen.findByRole('heading', { name: 'Permission not found' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument();
  });

  it('shows a load error with a retry for any other failure', async () => {
    const user = userEvent.setup();
    mockPermissionService.getPermissionById
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 500, data: { detail: 'Internal server error' } },
      })
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({ data: permission, message: '', meta: {} });
    renderDetail('admin');

    expect(
      await screen.findByText('Couldn’t load this permission')
    ).toBeInTheDocument();
    expect(screen.getByText('Internal server error')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Permission not found' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Network Error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'user.update' })
    ).toBeInTheDocument();
    expect(mockPermissionService.getPermissionById).toHaveBeenCalledTimes(3);
  });

  it('deletes after confirmation and returns to the list', async () => {
    const user = userEvent.setup();
    mockPermissionService.deletePermission.mockResolvedValue({
      success: true,
    });
    renderDetail('admin');

    await user.click(
      await screen.findByRole('button', { name: 'More actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText('Delete permission ‘user.update’?')
    ).toBeInTheDocument();
    expect(mockPermissionService.deletePermission).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', { name: 'Delete permission' })
    );

    expect(
      await screen.findByRole('heading', { name: 'Permissions list' })
    ).toBeInTheDocument();
    expect(mockPermissionService.deletePermission).toHaveBeenCalledWith(
      'perm-1'
    );
    expect(toast.success).toHaveBeenCalledWith('Permission deleted');
    expect(window.location.pathname).toBe('/dashboard/permissions');
  });

  it('keeps the dialog open and reports the error when delete fails', async () => {
    const user = userEvent.setup();
    mockPermissionService.deletePermission.mockRejectedValue(
      new Error('Permission is still granted by a role')
    );
    renderDetail('admin');

    await user.click(
      await screen.findByRole('button', { name: 'More actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete permission' })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Permission is still granted by a role'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard/permissions/perm-1');
  });
});
