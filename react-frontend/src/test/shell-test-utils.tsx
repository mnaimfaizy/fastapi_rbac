import { screen } from '@testing-library/react';
import { Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { mockUser, renderWithProviders, type AppStore } from './test-utils';
import { appRoutes } from '../App';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';

/** The read permissions behind the Access group, as the QA Admin holds them. */
const ACCESS_READ = [
  'user.read',
  'role.read',
  'role_group.read',
  'permission.read',
  'permission_group.read',
];

const SELF = ['self.read_profile', 'self.read_roles', 'self.read_permissions'];

function viewer(
  firstName: string,
  lastName: string,
  email: string,
  roleName: string,
  permissions: string[],
  isSuperuser = false
) {
  return {
    ...mockUser,
    first_name: firstName,
    last_name: lastName,
    email,
    is_superuser: isSuperuser,
    roles: [
      {
        id: roleName,
        name: roleName,
        description: `${roleName} role`,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        permissions: [],
      },
    ],
    permissions,
  };
}

/** One viewer per seeded role, with the permissions the seed gives it. */
export const shellViewers = {
  admin: viewer(
    'QA',
    'Admin',
    'admin@fastapi-rbac.example',
    'Admin',
    [
      ...ACCESS_READ,
      'user.create',
      'user.update',
      'user.delete',
      'role.create',
      'role.update',
      'role.delete',
      ...SELF,
    ],
    true
  ),
  manager: viewer('QA', 'Manager', 'manager@fastapi-rbac.example', 'Manager', [
    ...ACCESS_READ,
    'user.create',
    'user.update',
    ...SELF,
  ]),
  user: viewer('QA', 'User', 'user@fastapi-rbac.example', 'User', [...SELF]),
};

export type ShellRole = keyof typeof shellViewers;

/** Store state for a signed-in viewer of the given role. */
export function signedInAs(role: ShellRole) {
  return {
    auth: {
      user: shellViewers[role],
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      passwordChangeSuccess: false,
      passwordResetRequested: false,
      passwordResetSuccess: false,
    },
  };
}

/** A store with every reducer the app mounts, signed in as `role`. */
function appStore(role: ShellRole) {
  return configureStore({
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
}

/**
 * The app's own route tree (`appRoutes` from `App.tsx`) at /dashboard,
 * signed in as `role`: the production guards (`ProtectedRoute`,
 * `PublicOnlyRoute`), the shell and the real Sign in page. Test files that
 * use it mock `auth.service` and `dashboard.service`.
 */
export function renderApp(role: ShellRole = 'admin') {
  window.history.pushState({}, '', '/dashboard');
  return renderWithProviders(<Routes>{appRoutes}</Routes>, {
    testStore: appStore(role) as unknown as AppStore,
  });
}

/** The header user menu's trigger for the named viewer. */
export function userMenuTrigger(name = 'QA Admin') {
  return screen.getByRole('button', { name: `Account menu for ${name}` });
}
