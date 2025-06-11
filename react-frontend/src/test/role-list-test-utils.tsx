/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import authSlice from '../store/slices/authSlice';
import userSlice from '../store/slices/userSlice';
import roleSlice from '../store/slices/roleSlice';
import roleGroupSlice from '../store/slices/roleGroupSlice';
import permissionSlice from '../store/slices/permissionSlice';
import permissionGroupSlice from '../store/slices/permissionGroupSlice';
import {
  mockUser,
  mockRoles,
  mockRoleGroups,
  mockPermissions,
} from './test-utils';

// Create a test store that doesn't dispatch async thunks
export function createTestStoreForRoleList(
  preloadedState?: Record<string, unknown>
) {
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
      users: [],
      selectedUser: null,
      loading: false,
      error: null,
      pagination: {
        total: 0,
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

  const store = configureStore({
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

  // Mock the dispatch function to prevent async thunks from executing
  const originalDispatch = store.dispatch;
  store.dispatch = vi.fn((action: any) => {
    // Allow sync actions to go through
    if (typeof action === 'object' && action.type && !action.meta?.requestId) {
      return originalDispatch(action);
    }

    // For async thunks, return a resolved promise without executing
    if (typeof action === 'function' || action.meta?.requestId) {
      return Promise.resolve({
        type: action.type || 'mocked/thunk',
        payload: undefined,
      });
    }

    return originalDispatch(action);
  }) as any;

  return store;
}

// Custom render function with the mocked store
interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<unknown>;
  testStore?: ReturnType<typeof createTestStoreForRoleList>;
}

export function renderRoleListWithMockedDispatch(
  ui: ReactElement,
  options: ExtendedRenderOptions = {}
) {
  const {
    preloadedState,
    testStore = createTestStoreForRoleList(preloadedState),
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
