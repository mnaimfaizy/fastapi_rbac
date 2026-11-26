import { screen } from '@testing-library/react';
import { Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { renderWithProviders, type AppStore } from './test-utils';
import { signedInAs, type ShellRole } from './shell-test-utils';
import { appRoutes } from '../App';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';

/** Store state for a visitor who is not signed in. */
export function signedOut() {
  return {
    auth: {
      ...signedInAs('user').auth,
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    },
  };
}

/**
 * The app's own route tree at `path` (or the current URL when `null`),
 * signed in as `role`, or signed out when `role` is `null`. With
 * `userLoaded: false` the session is restored but the user record has not
 * arrived yet. Test files that use it mock `auth.service` and
 * `dashboard.service`.
 */
export function renderAppAt(
  path: string | null,
  role: ShellRole | null,
  { userLoaded = true }: { userLoaded?: boolean } = {}
) {
  if (path !== null) {
    window.history.pushState({}, '', path);
  }
  const state = role ? signedInAs(role) : signedOut();
  if (!userLoaded) {
    state.auth = { ...state.auth, user: null } as typeof state.auth;
  }
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

/** The shell's sidebar, present only when the page is inside the shell. */
export function queryShellSidebar() {
  return screen.queryByRole('navigation', { name: 'Main' });
}
