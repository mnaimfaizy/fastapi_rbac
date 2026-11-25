import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import { appRoutes } from '../App';
import MainLayout from '../components/layout/MainLayout';
import RoleDetail from '../features/roles/RoleDetail';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';
import { roleService } from '../services/role.service';
import { setAuthSessionHint, setStoredAccessToken } from '../lib/tokenStorage';
import { mockRoles, renderWithProviders, type AppStore } from './test-utils';
import { shellViewers, signedInAs, type ShellRole } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
vi.mock('../services/user.service');
vi.mock('../services/role.service');
vi.mock('../services/roleGroup.service');
vi.mock('../services/permission.service');

const mockRoleService = vi.mocked(roleService);

const APP = 'FastAPI RBAC';

/**
 * Every signed-in route in `App.tsx`, the permission its route guard asks
 * for (none for Account settings) and the title its tab should read for a
 * viewer who holds it.
 */
const ROUTES: [path: string, title: string, permission?: string][] = [
  ['/dashboard/account/profile', 'Profile · Account settings'],
  ['/dashboard/account/security', 'Security · Account settings'],
  ['/dashboard/account/appearance', 'Appearance · Account settings'],
  ['/dashboard/users', 'Users', 'user.read'],
  ['/dashboard/users/new', 'Add user · Users', 'user.create'],
  ['/dashboard/users/u1', 'Users', 'user.read'],
  ['/dashboard/users/u1/edit', 'Edit user · Users', 'user.update'],
  ['/dashboard/roles', 'Roles', 'role.read'],
  ['/dashboard/roles/new', 'Create role · Roles', 'role.create'],
  ['/dashboard/roles/r1', 'Roles', 'role.read'],
  ['/dashboard/roles/edit/r1', 'Edit role · Roles', 'role.update'],
  ['/dashboard/role-groups', 'Role groups', 'role_group.read'],
  [
    '/dashboard/role-groups/new',
    'Create role group · Role groups',
    'role_group.create',
  ],
  ['/dashboard/role-groups/g1', 'Role groups', 'role_group.read'],
  [
    '/dashboard/role-groups/edit/g1',
    'Edit role group · Role groups',
    'role_group.update',
  ],
  ['/dashboard/permissions', 'Permissions', 'permission.read'],
  [
    '/dashboard/permissions/new',
    'Create permission · Permissions',
    'permission.create',
  ],
  ['/dashboard/permissions/p1', 'Permissions', 'permission.read'],
  [
    '/dashboard/permission-groups',
    'Permission groups',
    'permission_group.read',
  ],
  [
    '/dashboard/permission-groups/new',
    'Create permission group · Permission groups',
    'permission_group.create',
  ],
  [
    '/dashboard/permission-groups/g1',
    'Permission groups',
    'permission_group.read',
  ],
  [
    '/dashboard/permission-groups/edit/g1',
    'Edit permission group · Permission groups',
    'permission_group.update',
  ],
];

function renderAppAt(path: string, role: ShellRole) {
  window.history.pushState({}, '', path);
  const store = configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
      permission: permissionReducer,
      permissionGroup: permissionGroupReducer,
      role: roleReducer,
      roleGroup: roleGroupReducer,
      dashboard: dashboardReducer,
    },
    preloadedState: signedInAs(role),
  });
  return renderWithProviders(<Routes>{appRoutes}</Routes>, {
    testStore: store as unknown as AppStore,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setStoredAccessToken('mock-access-token');
  setAuthSessionHint();
  document.title = '';
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('page titles', () => {
  it.each([
    ['admin', 'Dashboard'],
    ['manager', 'Dashboard'],
    ['user', 'Home'],
  ] as const)('titles the landing page for %s "%s"', async (role, title) => {
    renderAppAt('/dashboard', role);

    await waitFor(() => expect(document.title).toBe(`${title} | ${APP}`));
  });

  describe.each(['admin', 'manager', 'user'] as const)('as %s', (role) => {
    it.each(ROUTES)(
      'titles %s "%s" by what the viewer can open',
      async (path, title, permission) => {
        const allowed =
          !permission || shellViewers[role].permissions.includes(permission);
        renderAppAt(path, role);

        // A refused page is titled Unauthorized, never by the name of a page
        // the viewer cannot see in the nav.
        const expected = allowed ? title : 'Unauthorized';
        await waitFor(() =>
          expect(document.title).toBe(`${expected} | ${APP}`)
        );
        expect(document.title).not.toMatch(/^Dashboard\b/);
      }
    );
  });

  it('does not name a page the plain user cannot open', async () => {
    renderAppAt('/dashboard/users', 'user');

    await screen.findByRole('heading', { name: 'Unauthorized' });
    expect(document.title).toBe(`Unauthorized | ${APP}`);
  });

  it('does not name a create page the manager lacks the permission for', async () => {
    renderAppAt('/dashboard/roles/new', 'manager');

    await screen.findByRole('heading', { name: 'Unauthorized' });
    expect(document.title).toBe(`Unauthorized | ${APP}`);
  });

  it.each(['admin', 'manager'] as const)(
    'puts the role name first on its detail page for %s',
    async (role) => {
      const manager = mockRoles.find((r) => r.name === 'manager')!;
      mockRoleService.getRoleById.mockResolvedValue({
        data: { ...manager, id: 'r1', name: 'Manager', permissions: [] },
      } as never);
      window.history.pushState({}, '', '/dashboard/roles/r1');
      renderWithProviders(
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
          </Route>
        </Routes>,
        { preloadedState: signedInAs(role) }
      );

      await waitFor(() =>
        expect(document.title).toBe(`Manager · Roles | ${APP}`)
      );
    }
  );
});
