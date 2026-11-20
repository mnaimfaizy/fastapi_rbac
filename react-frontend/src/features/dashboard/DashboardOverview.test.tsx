import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { format } from 'date-fns';
import { renderWithProviders, type AppStore } from '@/test/test-utils';
import authReducer from '@/store/slices/authSlice';
import dashboardReducer from '@/store/slices/dashboardSlice';
import { dashboardService } from '../../services/dashboard.service';
import type { DashboardData, DashboardStats } from '@/models/dashboard';
import DashboardOverview from './DashboardOverview';

vi.mock('../../services/dashboard.service', () => ({
  dashboardService: {
    getDashboardData: vi.fn(),
  },
}));

const getDashboardData = vi.mocked(dashboardService.getDashboardData);

function viewer(roleName: string, superuser: boolean) {
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
    permissions: [] as string[],
  };
}

function renderDashboard(
  roleName: string,
  data: DashboardData,
  superuser = false
) {
  getDashboardData.mockResolvedValue(data);
  const testStore = configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
    },
    preloadedState: {
      auth: {
        user: viewer(roleName, superuser),
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
  });

  it('shows the admin metrics, the role chart and real sign-in times', async () => {
    const twelveAgo = new Date(Date.now() - 12 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    renderDashboard('Admin', filledDashboard(twelveAgo, yesterday), true);

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
      screen.getByRole('link', { name: 'View locked users' })
    ).toHaveAttribute('href', '/dashboard/users?status=Locked');

    const distribution = card('Role distribution');
    expect(distribution.getByText('Admin')).toBeInTheDocument();
    expect(distribution.getByText('3 4%')).toBeInTheDocument();
    expect(distribution.getByText('8 11%')).toBeInTheDocument();
    expect(distribution.getByText('64 85%')).toBeInTheDocument();
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
    expect(
      screen.getByRole('link', { name: 'View all users' })
    ).toHaveAttribute('href', '/dashboard/users');

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
    renderDashboard('Manager', filledDashboard(twelveAgo, yesterday));

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
      screen.getByRole('link', { name: 'View locked users' })
    ).toHaveAttribute('href', '/dashboard/users?status=Locked');
    expect(screen.queryByText('Illustrative data')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
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
      screen.queryByRole('link', { name: 'View locked users' })
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
        5
      );
    });
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'View locked users' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('No role distribution')).toBeInTheDocument();
    expect(screen.getByText('No recent sign-ins')).toBeInTheDocument();
  });
});
