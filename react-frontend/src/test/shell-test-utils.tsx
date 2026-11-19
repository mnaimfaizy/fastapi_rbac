import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { mockUser, renderWithProviders } from './test-utils';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';

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

/**
 * The signed-in shell at /dashboard behind the same guard `App.tsx` uses,
 * with the real Sign in page at /login.
 */
export function renderApp(role: ShellRole = 'admin') {
  window.history.pushState({}, '', '/dashboard');
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      />
    </Routes>,
    { preloadedState: signedInAs(role) }
  );
}

/** The header user menu's trigger for the named viewer. */
export function userMenuTrigger(name = 'QA Admin') {
  return screen.getByRole('button', { name: `Account menu for ${name}` });
}
