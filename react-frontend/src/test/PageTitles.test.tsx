import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
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
import { signedInAs, type ShellRole } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
vi.mock('../services/user.service');
vi.mock('../services/role.service');
vi.mock('../services/roleGroup.service');
vi.mock('../services/permission.service');

const mockRoleService = vi.mocked(roleService);

const APP = 'FastAPI RBAC';

/** Every signed-in route in `App.tsx`, with the title its tab should read. */
const ROUTES: [path: string, title: string][] = [
  ['/dashboard/account/profile', 'Profile · Account settings'],
  ['/dashboard/account/security', 'Security · Account settings'],
  ['/dashboard/account/appearance', 'Appearance · Account settings'],
  ['/dashboard/users', 'Users'],
  ['/dashboard/users/new', 'Add user · Users'],
  ['/dashboard/users/u1', 'Users'],
  ['/dashboard/users/u1/edit', 'Edit user · Users'],
  ['/dashboard/roles', 'Roles'],
  ['/dashboard/roles/new', 'Create role · Roles'],
  ['/dashboard/roles/r1', 'Roles'],
  ['/dashboard/roles/edit/r1', 'Edit role · Roles'],
  ['/dashboard/role-groups', 'Role groups'],
  ['/dashboard/role-groups/new', 'Create role group · Role groups'],
  ['/dashboard/role-groups/g1', 'Role groups'],
  ['/dashboard/role-groups/edit/g1', 'Edit role group · Role groups'],
  ['/dashboard/permissions', 'Permissions'],
  ['/dashboard/permissions/new', 'Create permission · Permissions'],
  ['/dashboard/permissions/p1', 'Permissions'],
  ['/dashboard/permission-groups', 'Permission groups'],
  [
    '/dashboard/permission-groups/new',
    'Create permission group · Permission groups',
  ],
  ['/dashboard/permission-groups/g1', 'Permission groups'],
  [
    '/dashboard/permission-groups/edit/g1',
    'Edit permission group · Permission groups',
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
    it.each(ROUTES)('titles %s "%s"', async (path, title) => {
      renderAppAt(path, role);

      await waitFor(() => expect(document.title).toBe(`${title} | ${APP}`));
      expect(document.title).not.toMatch(/^Dashboard\b/);
    });
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
