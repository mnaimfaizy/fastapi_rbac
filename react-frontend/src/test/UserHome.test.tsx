import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes } from 'react-router-dom';
import { appRoutes } from '../App';
import UserHome from '../features/user-home/UserHome';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '../features/auth/notices';
import authService from '../services/auth.service';
import { dashboardService } from '../services/dashboard.service';
import authReducer from '../store/slices/authSlice';
import userReducer from '../store/slices/userSlice';
import permissionReducer from '../store/slices/permissionSlice';
import permissionGroupReducer from '../store/slices/permissionGroupSlice';
import roleReducer from '../store/slices/roleSlice';
import roleGroupReducer from '../store/slices/roleGroupSlice';
import dashboardReducer from '../store/slices/dashboardSlice';
import { renderWithProviders, type AppStore } from './test-utils';
import { signedInAs, type ShellRole } from './shell-test-utils';
import type { User } from '../models/user';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');

const mockAuthService = vi.mocked(authService);
const mockDashboardService = vi.mocked(dashboardService);

const USER_PERMISSIONS = [
  'self.read_profile',
  'self.update_profile',
  'self.read_roles',
  'self.read_permissions',
  'content.read_article',
];

function landingStore(role: ShellRole, user?: User) {
  const state = signedInAs(role);
  if (user) {
    state.auth = { ...state.auth, user };
  }
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
    preloadedState: state,
  });
}

function renderLanding(role: ShellRole, path = '/dashboard', user?: User) {
  window.history.pushState({}, '', path);
  return renderWithProviders(<Routes>{appRoutes}</Routes>, {
    testStore: landingStore(role, user) as unknown as AppStore,
  });
}

function userWith(overrides: Partial<User> = {}): User {
  const base = signedInAs('user').auth.user;
  return {
    ...base,
    permissions: USER_PERMISSIONS,
    last_changed_password_date: '2026-08-29T00:00:00.000Z',
    verified: true,
    ...overrides,
  };
}

function renderHome(overrides: Partial<User> = {}) {
  const state = signedInAs('user');
  state.auth = { ...state.auth, user: userWith(overrides) };
  return renderWithProviders(<UserHome />, { preloadedState: state });
}

function panelTitles(): (string | null)[] {
  return screen
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);
}

function focusableLabels(): (string | null)[] {
  return [
    screen.getByRole('link', { name: /Edit profile/ }),
    screen.getByRole('link', { name: /Change password/ }),
    screen.getByRole('button', { name: /Sign out everywhere/ }),
  ]
    .slice()
    .sort((a, b) => {
      const following = a.compareDocumentPosition(b);
      return following & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    })
    .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}

describe('Signed-in home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    mockDashboardService.getDashboardData.mockResolvedValue({
      stats: { total_users: 3, total_roles: 2, total_permissions: 4 },
      recent_logins: [],
      system_users_summary: [],
    });
  });

  it('lands a plain user on User home after sign-in', async () => {
    renderLanding('user', '/login', userWith());

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Good (morning|afternoon|evening), QA/,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Dashboard' })
    ).not.toBeInTheDocument();
  });

  it.each([['admin' as const], ['manager' as const]])(
    'lands a %s on the dashboard',
    async (role) => {
      renderLanding(role, '/login');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /Edit profile/ })
      ).not.toBeInTheDocument();
    }
  );

  it('lands a user who holds an access permission on the dashboard', async () => {
    renderLanding(
      'user',
      '/dashboard',
      userWith({ permissions: [...USER_PERMISSIONS, 'user.read'] })
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeInTheDocument();
  });
});

describe('User home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('greets the user and summarises the account without an expiry date', () => {
    renderHome();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Good (morning|afternoon|evening), QA/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText('You hold the User role with 5 permissions.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/password expires/)).not.toBeInTheDocument();
  });

  it('shows the profile summary and an Edit profile link', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { name: 'Profile' })
    ).toBeInTheDocument();
    expect(screen.getByText('QA User')).toBeInTheDocument();
    expect(screen.getByText('user@fastapi-rbac.example')).toBeInTheDocument();
    expect(screen.getByText('QU')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit profile/ })).toHaveAttribute(
      'href',
      '/dashboard/account'
    );
  });

  it('shows the user own roles and permissions grouped by permission group', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { name: 'Your roles and permissions' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('What you can do in FastAPI RBAC')
    ).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();

    const self = screen.getByRole('group', { name: 'Self' });
    expect(within(self).getByText('self.read_profile')).toBeInTheDocument();
    expect(within(self).getByText('self.read_roles')).toBeInTheDocument();
    expect(within(self).getByText('self.read_permissions')).toBeInTheDocument();
    expect(within(self).getByText('self.update_profile')).toBeInTheDocument();
    expect(
      within(self).queryByText('content.read_article')
    ).not.toBeInTheDocument();

    const content = screen.getByRole('group', { name: 'Content' });
    expect(
      within(content).getByText('content.read_article')
    ).toBeInTheDocument();
    expect(screen.queryByText('user.read')).not.toBeInTheDocument();
  });

  it('keeps a multi-word permission group in seed order', () => {
    renderHome({
      permissions: [
        'content.read_article',
        'permission_group.read',
        'role_group.read',
        'self.read_profile',
      ],
    });

    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.getAttribute('aria-label'))
    ).toEqual(['Role group', 'Permission group', 'Self', 'Content']);
  });

  it('puts the mobile panels in tab order', () => {
    renderHome();

    expect(panelTitles()).toEqual([
      'Security status',
      'Quick actions',
      'Profile',
      'Your roles and permissions',
    ]);
    expect(focusableLabels()).toEqual([
      'Change password',
      'Sign out everywhere',
      'Edit profile',
    ]);
  });

  it('puts the desktop panels in tab order', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    try {
      renderHome();

      expect(panelTitles()).toEqual([
        'Profile',
        'Quick actions',
        'Security status',
        'Your roles and permissions',
      ]);
      expect(focusableLabels()).toEqual([
        'Edit profile',
        'Change password',
        'Sign out everywhere',
      ]);
    } finally {
      window.matchMedia = original;
    }
  });

  it('shows password age, verified status and last password change, and hides expiry until the API sends it', () => {
    renderHome();

    const security = screen.getByRole('region', { name: 'Security status' });
    expect(within(security).getByText('Password age')).toBeInTheDocument();
    expect(within(security).getByText('82 days')).toBeInTheDocument();
    expect(within(security).getByText('Verified')).toBeInTheDocument();
    expect(
      within(security).getByText('Last password change')
    ).toBeInTheDocument();
    expect(within(security).getByText('29 Aug 2026')).toBeInTheDocument();
    expect(within(security).queryByText('Expires')).not.toBeInTheDocument();
    expect(within(security).queryByText('Unverified')).not.toBeInTheDocument();
  });

  it('shows expiry once the user record carries it', () => {
    renderHome({ password_expires_at: '2026-11-27T00:00:00.000Z' });

    const security = screen.getByRole('region', { name: 'Security status' });
    expect(within(security).getByText('Expires')).toBeInTheDocument();
    expect(within(security).getByText('27 Nov 2026')).toBeInTheDocument();
    expect(within(security).getByText('In 8 days')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You hold the User role with 5 permissions. Your password expires in 8 days.'
      )
    ).toBeInTheDocument();
  });

  it('shows Pending for an unverified email', () => {
    renderHome({ verified: false });

    const security = screen.getByRole('region', { name: 'Security status' });
    expect(within(security).getByText('Pending')).toBeInTheDocument();
    expect(within(security).queryByText('Unverified')).not.toBeInTheDocument();
  });

  it('offers Change password and confirms Sign out everywhere', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    renderHome();

    expect(
      screen.getByRole('link', { name: /Change password/ })
    ).toHaveAttribute('href', '/dashboard/change-password');
    expect(
      screen.getByText(
        'Signing out everywhere ends your sessions on every device, including this one.'
      )
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Sign out everywhere/ })
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Sign out everywhere?' })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('You’ll be signed out on this device too.')
    ).toBeInTheDocument();
    expect(mockAuthService.logoutAll).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole('button', { name: 'Sign out everywhere' })
    );

    expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/login');
    expect(window.location.search).toBe(
      `?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
    );
  });
});
