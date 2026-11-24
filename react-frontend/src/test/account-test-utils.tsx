import { screen, within } from '@testing-library/react';
import { Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import { appRoutes } from '../App';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';
import { setAuthSessionHint, setStoredAccessToken } from '../lib/tokenStorage';
import { renderWithProviders, type AppStore } from './test-utils';
import type { User } from '../models/user';
import { signedInAs, type ShellRole } from './shell-test-utils';

/** Each seeded role with the name its header menu shows. */
export const ACCOUNT_ROLES: [ShellRole, string][] = [
  ['admin', 'QA Admin'],
  ['manager', 'QA Manager'],
  ['user', 'QA User'],
];

/**
 * The app's own route tree at `path`, signed in as `role` (holding
 * `self.update_profile`, as every seeded role does), with any fields
 * of the signed-in user replaced by `overrides`. Test files that use it mock
 * `auth.service`, `user.service` and `dashboard.service`.
 */
export function renderAccountAt(
  path: string,
  role: ShellRole = 'admin',
  overrides: Partial<User> = {}
) {
  window.history.pushState({}, '', path);
  const state = signedInAs(role);
  // Every seeded role holds self.update_profile; the shell fixtures leave it out.
  state.auth.user = {
    ...state.auth.user,
    permissions: [...state.auth.user.permissions, 'self.update_profile'],
    ...overrides,
  };
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
    preloadedState: state,
  });
  return renderWithProviders(<Routes>{appRoutes}</Routes>, {
    testStore: store as unknown as AppStore,
  });
}

/** A link in the page's tab row. */
export function accountTab(name: string) {
  return within(
    screen.getByRole('navigation', { name: 'Account settings sections' })
  ).getByRole('link', { name });
}

/** A fresh browser: no theme choice, a stored session. */
export function resetBrowser() {
  window.localStorage.clear();
  document.documentElement.className = '';
  setStoredAccessToken('mock-access-token');
  setAuthSessionHint();
}
