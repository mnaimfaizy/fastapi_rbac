import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import PermissionDetail from '@/features/permissions/PermissionDetail';
import permissionService from '@/services/permission.service';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';

vi.mock('@/services/permission.service');

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
    </Routes>,
    { preloadedState: viewerState(role) }
  );
}

describe('Permission detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
