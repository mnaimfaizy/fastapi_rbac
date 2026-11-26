import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { format } from 'date-fns';
import { renderWithProviders, type AppStore } from '@/test/test-utils';
import authReducer from '@/store/slices/authSlice';
import dashboardReducer from '@/store/slices/dashboardSlice';
import userReducer from '@/store/slices/userSlice';
import { dashboardService } from '../../services/dashboard.service';
import userService from '../../services/user.service';
import type { DashboardData, DashboardStats } from '@/models/dashboard';
import type { User } from '@/models/user';
import UsersList from '../users/UsersList';
import DashboardOverview from './DashboardOverview';

vi.mock('../../services/dashboard.service', () => ({
  dashboardService: {
    getDashboardData: vi.fn(),
  },
}));
vi.mock('../../services/user.service');

const getUsers = vi.mocked(userService.getUsers);

const getDashboardData = vi.mocked(dashboardService.getDashboardData);

// What the seed gives each role (backend/app/db/init_db.py): an admin manages
// roles and permissions; a manager can only read them.
const ADMIN_PERMISSIONS = [
  'user.read',
  'role.create',
  'role.read',
  'role.update',
  'role.delete',
  'role_group.read',
  'permission.create',
  'permission.read',
  'permission.update',
  'permission.delete',
  'permission_group.read',
];
const MANAGER_PERMISSIONS = [
  'user.create',
  'user.read',
  'user.update',
  'role.read',
  'role_group.read',
  'permission.read',
  'permission_group.read',
];

function viewer(roleName: string, superuser: boolean, permissions: string[]) {
  return {
    id: '1',
    email: `${roleName.toLowerCase()}@example.com`,
    first_name: 'QA',
    last_name: roleName,
    is_active: true,
    is_superuser: superuser,
    is_locked: false,
    locked_until: null,
    needs_to_change_password: false,
    verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_changed_password_date: null,
    contact_phone: null,
    number_of_failed_attempts: 0,
    verification_code: null,
    last_updated_by: null,
    roles: [{ id: '1', name: roleName }],
    permissions,
  };
}

function renderDashboard(
  roleName: string,
  data: DashboardData,
  superuser = false,
  permissions: string[] = []
) {
  getDashboardData.mockResolvedValue(data);
  const testStore = configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
    },
    preloadedState: {
      auth: {
        user: viewer(roleName, superuser, permissions),
        accessToken: 'token',
        refreshToken: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        passwordChangeSuccess: false,
        passwordResetRequested: false,
        passwordResetSuccess: false,
      },
    },
  });
  return renderWithProviders(<DashboardOverview />, {
    testStore: testStore as unknown as AppStore,
  });
}

function card(title: string) {
  const heading = screen.getByText(title);
  const root = heading.closest('[data-slot="card"]');
  if (!root) {
    throw new Error(`No card for ${title}`);
  }
  return within(root as HTMLElement);
}

/** A role distribution row as [role, users, share], read from the table. */
function distributionRows(distribution: ReturnType<typeof within>) {
  return distribution
    .getAllByRole('row')
    .filter((row) => within(row).queryByRole('rowheader'))
    .map((row) => [
      within(row).getByRole('rowheader').textContent ?? '',
      ...within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent?.trim() ?? '')
        .filter(Boolean),
    ]);
}

function filledDashboard(twelveAgo: Date, yesterday: Date): DashboardData {
  const stats: DashboardStats & { active_sessions?: number } = {
    total_users: 75,
    active_users: 71,
    total_roles: 3,
    total_role_groups: 3,
    total_permissions: 29,
    total_permission_groups: 7,
    locked_users: 2,
    active_sessions: 0,
  };
  return {
    stats,
    role_distribution: [
      { name: 'Admin', count: 3 },
      { name: 'Manager', count: 8 },
      { name: 'User', count: 64 },
    ],
    recent_sign_ins: [
      {
        id: 'mei',
        name: 'Mei Tanaka',
        email: 'mei.tanaka@example.com',
        signed_in_at: twelveAgo.toISOString(),
      },
      {
        id: 'qu',
        name: 'QA User',
        email: 'user@example.com',
        signed_in_at: yesterday.toISOString(),
      },
    ],
  };
}

const emptyDashboard: DashboardData = {
  stats: {
    total_users: null,
    active_users: null,
    total_roles: null,
    total_role_groups: null,
    total_permissions: null,
    total_permission_groups: null,
    locked_users: null,
  },
  role_distribution: null,
  recent_sign_ins: null,
};

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('opens the users list filtered to locked users from the Locked accounts card', async () => {
    const person = (id: string, name: string, overrides: Partial<User> = {}) =>
      ({
        ...viewer('User', false, []),
        id,
        email: `${name.toLowerCase()}@example.com`,
        first_name: name,
        last_name: 'Person',
        roles: [],
        ...overrides,
      }) as unknown as User;
    const everyone = [
      person('u-locked', 'Marcus', {
        is_locked: true,
        locked_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
      person('u-expired', 'Elena', {
        is_locked: true,
        locked_until: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
      person('u-healthy', 'Hannah'),
    ];
    // Like the API: `status=locked` answers with the locked users only.
    getUsers.mockImplementation(async (_page, _limit, _search, status) => {
      const items = status === 'locked' ? [everyone[0]] : everyone;
      return {
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
        previous_page: null,
        next_page: null,
      };
    });
    getDashboardData.mockResolvedValue(filledDashboard(new Date(), new Date()));
    const testStore = configureStore({
      reducer: {
        auth: authReducer,
        dashboard: dashboardReducer,
        user: userReducer,
      },
      preloadedState: {
        auth: {
          user: viewer('Admin', true, ADMIN_PERMISSIONS),
          accessToken: 'token',
          refreshToken: null,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          passwordChangeSuccess: false,
          passwordResetRequested: false,
          passwordResetSuccess: false,
        },
      },
    });
    window.history.pushState({}, '', '/dashboard');
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<DashboardOverview />} />
        <Route path="/dashboard/users" element={<UsersList />} />
      </Routes>,
      { testStore: testStore as unknown as AppStore }
    );

    await userEvent.click(
      await screen.findByRole('link', { name: 'View locked users' })
    );

    expect(await screen.findByText('marcus@example.com')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard/users');
    expect(window.location.search).toBe('?status=Locked');
    expect(screen.queryByText('elena@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('hannah@example.com')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /filter by status/i })
    ).toHaveTextContent('Status:Locked');
    expect(getUsers).toHaveBeenLastCalledWith(1, 100, undefined, 'locked');
  });

  it('shows the admin metrics, the role chart and real sign-in times', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    renderDashboard(
      'Admin',
      filledDashboard(twelveAgo, yesterday),
      true,
      ADMIN_PERMISSIONS
    );

    expect(
      await screen.findByText(
        "Welcome back, QA Admin. Here's the state of access today."
      )
    ).toBeInTheDocument();
    expect(card('Total users').getByText('75')).toBeInTheDocument();
    expect(card('Total users').getByText('4 inactive')).toBeInTheDocument();
    expect(card('Active users').getByText('71')).toBeInTheDocument();
    expect(card('Active users').getByText('Of 75 total')).toBeInTheDocument();
    expect(card('Roles').getByText('3')).toBeInTheDocument();
    expect(card('Roles').getByText('In 3 role groups')).toBeInTheDocument();
    expect(card('Permissions').getByText('29')).toBeInTheDocument();
    expect(
      card('Permissions').getByText('In 7 permission groups')
    ).toBeInTheDocument();
    expect(card('Locked accounts').getByText('2')).toBeInTheDocument();
    expect(
      card('Locked accounts').getByRole('link', { name: 'View locked users' })
    ).toHaveAttribute('href', '/dashboard/users?status=Locked');

    const distribution = card('Role distribution');
    expect(distribution.getByText('Admin')).toBeInTheDocument();
    expect(distributionRows(distribution)).toEqual([
      ['Admin', '3', '4%'],
      ['Manager', '8', '11%'],
      ['User', '64', '85%'],
    ]);
    // One stacked bar, a segment per role, sized by share of assignments.
    expect(
      distribution.getByRole('img', { name: 'Admin 3, Manager 8, User 64' })
    ).toBeInTheDocument();
    const segments = distribution.getAllByTestId('role-distribution-segment');
    expect(segments.map((segment) => segment.style.width)).toEqual([
      '4%',
      '10.67%',
      '85.33%',
    ]);
    expect(
      distribution.getByText('Users with several roles are counted in each.')
    ).toBeInTheDocument();

    expect(screen.getByText('12 minutes ago')).toHaveAttribute(
      'title',
      format(twelveAgo, 'd MMM yyyy, HH:mm')
    );
    expect(screen.getByText('Yesterday')).toHaveAttribute(
      'title',
      format(yesterday, 'd MMM yyyy, HH:mm')
    );
    expect(screen.getByText('mei.tanaka@example.com')).toBeInTheDocument();
    const viewAll = screen.getByRole('link', { name: 'View all users' });
    expect(viewAll).toHaveAttribute('href', '/dashboard/users');
    // In the card header, beside the title, as the artboard places it.
    expect(viewAll.closest('[data-slot="card-header"]')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeInTheDocument();

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Illustrative data')).not.toBeInTheDocument();
    expect(screen.queryByText('User Activity Trends')).not.toBeInTheDocument();
    expect(screen.queryByText('System Users Overview')).not.toBeInTheDocument();
    expect(screen.queryByText(/expiring/i)).not.toBeInTheDocument();
  });

  it('drops role and permission stats for a manager and keeps the shared metrics', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // A seeded manager holds role.read and permission.read, so the API sends
    // every field. The cards still stay off: a manager does not manage the
    // roles or permissions catalogue.
    renderDashboard(
      'Manager',
      filledDashboard(twelveAgo, yesterday),
      false,
      MANAGER_PERMISSIONS
    );

    expect(
      await screen.findByText(
        "Welcome back, QA Manager. Here's the state of access today."
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Total users')).toBeInTheDocument();
    expect(screen.getByText('Active users')).toBeInTheDocument();
    expect(screen.getByText('Locked accounts')).toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText(/role group/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/permission group/i)).not.toBeInTheDocument();
    expect(
      card('Role distribution').getByText(
        'Users with several roles are counted in each.'
      )
    ).toBeInTheDocument();
    expect(
      card('Locked accounts').getByRole('link', { name: 'View locked users' })
    ).toHaveAttribute('href', '/dashboard/users?status=Locked');
    expect(screen.queryByText('Illustrative data')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows each role as a share of all users, not of role assignments', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filled = filledDashboard(twelveAgo, yesterday);
    // 10 users who all hold both roles: the counts sum to 20, but every user
    // holds each role, so each row is 100%, not 50%.
    renderDashboard('Admin', {
      ...filled,
      stats: { ...filled.stats, total_users: 10, active_users: 10 },
      role_distribution: [
        { name: 'Admin', count: 10 },
        { name: 'Manager', count: 10 },
      ],
    });

    const distribution = within(
      (await screen.findByText('Role distribution')).closest(
        '[data-slot="card"]'
      ) as HTMLElement
    );
    expect(distributionRows(distribution)).toEqual([
      ['Admin', '10', '100%'],
      ['Manager', '10', '100%'],
    ]);
    expect(distribution.queryByText(/50%/)).not.toBeInTheDocument();
    expect(
      distribution.getByText(
        'Percentages are the share of all users who hold the role.'
      )
    ).toBeInTheDocument();
  });

  it('shows role counts without percentages when the user total is hidden', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filled = filledDashboard(twelveAgo, yesterday);
    // role.read without user.read: the API sends role_distribution but no
    // total_users, so there is no honest denominator.
    renderDashboard('Auditor', {
      ...filled,
      stats: {
        ...filled.stats,
        total_users: null,
        active_users: null,
        locked_users: null,
      },
      recent_sign_ins: null,
    });

    const distribution = within(
      (await screen.findByText('Role distribution')).closest(
        '[data-slot="card"]'
      ) as HTMLElement
    );
    expect(distribution.getByText('64')).toBeInTheDocument();
    expect(distribution.queryByText(/%/)).not.toBeInTheDocument();
    expect(
      distribution.getByText('Users with several roles are counted in each.')
    ).toBeInTheDocument();
  });

  it('shows empty states for a plain user and no admin metrics or fake chart', async () => {
    renderDashboard('User', emptyDashboard);

    expect(
      await screen.findByText(
        "Welcome back, QA User. Here's the state of access today."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('No data yet').length).toBeGreaterThan(0);
    expect(screen.getByText('No role distribution')).toBeInTheDocument();
    expect(screen.getByText('No recent sign-ins')).toBeInTheDocument();
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Users with several roles are counted in each.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /locked users/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('mei.tanaka@example.com')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('Illustrative data')).not.toBeInTheDocument();
    expect(screen.queryByText('User Activity Trends')).not.toBeInTheDocument();
    expect(screen.queryByText('System Users Overview')).not.toBeInTheDocument();
  });

  it('shows an empty state on an admin card whose data is missing', async () => {
    renderDashboard('Admin', emptyDashboard, true);

    await waitFor(() => {
      expect(screen.getAllByText('No data yet').length).toBeGreaterThanOrEqual(
        3
      );
    });
    // The API sent no role or permission fields, so those cards are not shown
    // even though the viewer is an admin.
    expect(screen.queryByText('Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /locked users/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText('No role distribution')).toBeInTheDocument();
    expect(screen.getByText('No recent sign-ins')).toBeInTheDocument();
  });

  it('shows the roles and permissions cards by permission, not by role name', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const data = filledDashboard(twelveAgo, yesterday);
    renderDashboard('Auditor', data, false, [
      'role.read',
      'role.update',
      'permission.read',
      'permission.delete',
    ]);

    expect(await screen.findByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(card('Roles').getByText('3')).toBeInTheDocument();
  });

  it('shows only the roles card to someone who manages roles but not permissions', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    renderDashboard(
      'Role editor',
      filledDashboard(twelveAgo, yesterday),
      false,
      [...MANAGER_PERMISSIONS, 'role.update']
    );

    expect(await screen.findByText('Roles')).toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
  });

  it('hides the permissions card when only the role fields were sent', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const data = filledDashboard(twelveAgo, yesterday);
    renderDashboard(
      'Admin',
      {
        ...data,
        stats: {
          ...data.stats,
          total_permissions: null,
          total_permission_groups: null,
        },
      },
      true,
      ADMIN_PERMISSIONS
    );

    expect(await screen.findByText('Roles')).toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
  });
});
