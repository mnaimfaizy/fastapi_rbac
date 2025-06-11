import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authSlice from '../store/slices/authSlice';
import userSlice from '../store/slices/userSlice';
import roleSlice from '../store/slices/roleSlice';
import roleGroupSlice from '../store/slices/roleGroupSlice';
import permissionSlice from '../store/slices/permissionSlice';
import permissionGroupSlice from '../store/slices/permissionGroupSlice';

// Mock data for testing
export const mockPermissions = [
  {
    id: '1',
    name: 'user.read',
    description: 'Read user information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'user.create',
    description: 'Create new users',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'user.update',
    description: 'Update user information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'user.delete',
    description: 'Delete users',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'role.read',
    description: 'Read role information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'role.create',
    description: 'Create new roles',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '7',
    name: 'role.update',
    description: 'Update role information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '8',
    name: 'role.delete',
    description: 'Delete roles',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '9',
    name: 'permission.read',
    description: 'Read permission information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '10',
    name: 'permission.create',
    description: 'Create new permissions',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '11',
    name: 'permission.delete',
    description: 'Delete permissions',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '12',
    name: 'role_group.read',
    description: 'Read role group information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

export const mockRoles = [
  {
    id: '1',
    name: 'user',
    description: 'Regular user role',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: mockPermissions.slice(0, 4), // user permissions
  },
  {
    id: '2',
    name: 'admin',
    description: 'Administrator role',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: mockPermissions, // all permissions
  },
];

export const mockRoleGroups = [
  {
    id: '1',
    name: 'User Management',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    parent_id: undefined,
  },
  {
    id: '2',
    name: 'System Administration',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    parent_id: undefined,
  },
];

export const mockUsers = [
  {
    id: '1',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    is_active: true,
    is_superuser: false,
    is_locked: false,
    locked_until: null,
    needs_to_change_password: false,
    verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    expiry_date: null,
    last_changed_password_date: null,
    contact_phone: null,
    number_of_failed_attempts: 0,
    verification_code: null,
    last_updated_by: null,
    roles: [mockRoles[0]],
    permissions: ['user.read', 'user.create', 'user.update', 'user.delete'],
    role_id: ['1'],
  },
  {
    id: '2',
    email: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'User',
    is_active: true,
    is_superuser: true,
    is_locked: false,
    locked_until: null,
    needs_to_change_password: false,
    verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    expiry_date: null,
    last_changed_password_date: null,
    contact_phone: null,
    number_of_failed_attempts: 0,
    verification_code: null,
    last_updated_by: null,
    roles: [mockRoles[1]],
    permissions: mockPermissions.map((p) => p.name), // all permission names
    role_id: ['2'],
  },
];

export const mockUser = mockUsers[1]; // Use admin user by default for comprehensive permissions

export const mockToken = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  refresh_token: 'mock-refresh-token',
  user: mockUser,
};

// Create test store with mock data
export function createTestStore(preloadedState?: Record<string, unknown>) {
  const defaultState = {
    auth: {
      user: mockUser,
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      passwordChangeSuccess: false,
      passwordResetRequested: false,
      passwordResetSuccess: false,
    },
    user: {
      users: mockUsers,
      selectedUser: null,
      loading: false,
      error: null,
      pagination: {
        total: mockUsers.length,
        page: 1,
        size: 10,
        pages: 1,
        previousPage: null,
        nextPage: null,
      },
    },
    role: {
      roles: mockRoles,
      allRoles: mockRoles,
      currentRole: null,
      pagination: {
        total: mockRoles.length,
        page: 1,
        size: 10,
        pages: 1,
      },
      loading: false,
      error: null,
    },
    roleGroup: {
      roleGroups: mockRoleGroups,
      currentRoleGroup: null,
      loading: false,
      error: null,
      pagination: {
        total: mockRoleGroups.length,
        page: 1,
        size: 10,
        pages: 1,
        previousPage: null,
        nextPage: null,
      },
    },
    permission: {
      permissions: mockPermissions,
      currentPermission: null,
      isLoading: false,
      error: null,
      totalItems: mockPermissions.length,
      page: 1,
      pageSize: 10,
    },
    permissionGroup: {
      permissionGroups: [],
      currentPermissionGroup: null,
      isLoading: false,
      error: null,
      totalItems: 0,
      page: 1,
      pageSize: 10,
    },
  };

  return configureStore({
    reducer: {
      auth: authSlice,
      user: userSlice,
      role: roleSlice,
      roleGroup: roleGroupSlice,
      permission: permissionSlice,
      permissionGroup: permissionGroupSlice,
    },
    preloadedState: {
      ...defaultState,
      ...preloadedState,
    },
  });
}

// Get the type of the root state and store from test store
export type RootState = ReturnType<
  ReturnType<typeof createTestStore>['getState']
>;
export type AppStore = ReturnType<typeof createTestStore>;

// Custom render function with providers
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<unknown>;
  testStore?: AppStore;
}

export function renderWithProviders(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
) {
  const {
    preloadedState,
    testStore = createTestStore(preloadedState),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={testStore}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    );
  }

  return {
    store: testStore,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Helper functions for testing
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};
