import { Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { renderWithProviders, type AppStore } from './test-utils';
import { shellViewers, type ShellRole } from './shell-test-utils';
import { appRoutes } from '../App';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';

/**
 * The seeded viewers, with the group write permissions the seeded Admin
 * role holds. The Manager reads groups only; the User cannot open them.
 */
export const groupViewers = {
  admin: {
    ...shellViewers.admin,
    permissions: [
      ...shellViewers.admin.permissions,
      'role_group.create',
      'role_group.update',
      'role_group.delete',
      'permission_group.create',
      'permission_group.update',
      'permission_group.delete',
    ],
  },
  manager: shellViewers.manager,
  user: shellViewers.user,
};

/** A paginated service response holding `items`. */
export function page<T>(items: T[]) {
  return {
    message: 'ok',
    meta: {},
    data: {
      items,
      total: items.length,
      page: 1,
      size: 100,
      pages: 1,
      next_page: null,
      previous_page: null,
    },
  };
}

/**
 * The app's own routes at `path`, signed in as `role`. Test files that use
 * it mock `auth.service`, `dashboard.service` and the group services.
 */
export function renderGroupsAt(path: string, role: ShellRole = 'admin') {
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
    preloadedState: {
      auth: {
        user: groupViewers[role],
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        passwordChangeSuccess: false,
        passwordResetRequested: false,
        passwordResetSuccess: false,
      },
    },
  });
  return renderWithProviders(<Routes>{appRoutes}</Routes>, {
    testStore: store as unknown as AppStore,
  });
}
