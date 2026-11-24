import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockUsers, mockRoles } from './test-utils';
import UsersList from '../features/users/UsersList';
import userService from '../services/user.service';
import type { User } from '../models/user';

vi.mock('../services/user.service');
const mockUserService = vi.mocked(userService);

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const managerRole = {
  id: '3',
  name: 'manager',
  description: 'Manager role',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  permissions: [],
};

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    ...(mockUsers[0] as unknown as User),
    ...overrides,
  };
}

const listUsers: User[] = [
  makeUser({
    id: 'u-ada',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    roles: [mockRoles[1]],
    contact_phone: '+1 555 0100',
    number_of_failed_attempts: 2,
    created_at: '2026-03-04T10:00:00Z',
    last_changed_password_date: '2026-05-06T10:00:00Z',
  }),
  makeUser({
    id: 'u-marcus',
    first_name: 'Marcus',
    last_name: 'Webb',
    email: 'marcus@example.com',
    roles: [managerRole],
    is_locked: true,
    locked_until: '2026-11-24T14:05:00Z',
  }),
  makeUser({
    id: 'u-hannah',
    first_name: 'Hannah',
    last_name: 'Lindqvist',
    email: 'hannah@example.com',
    roles: [mockRoles[0]],
    verified: false,
  }),
  makeUser({
    id: 'u-aisha',
    first_name: 'Aisha',
    last_name: 'Karim',
    email: 'aisha@example.com',
    roles: [mockRoles[0]],
    is_active: false,
  }),
];

function pageOf(items: User[]) {
  return {
    items,
    total: items.length,
    page: 1,
    size: 100,
    pages: 1,
    previous_page: null,
    next_page: null,
  };
}

function viewer(permissions: string[], name = 'Viewer') {
  return {
    auth: {
      user: {
        id: 'viewer',
        email: 'viewer@example.com',
        first_name: name,
        last_name: 'Person',
        permissions,
        roles: [],
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
  };
}

const ADMIN = [
  'user.read',
  'user.create',
  'user.update',
  'user.delete',
  'role.read',
];

async function renderList(
  permissions: string[] = ADMIN,
  users: User[] = listUsers
) {
  mockUserService.getUsers.mockResolvedValue(pageOf(users));
  const result = renderWithProviders(<UsersList />, {
    preloadedState: viewer(permissions),
  });
  if (users.length > 0) {
    await screen.findAllByText(users[0].email);
  }
  return result;
}

function table() {
  return screen.getByRole('table');
}

function rowFor(name: string) {
  return within(table())
    .getByRole('link', { name })
    .closest('tr') as HTMLElement;
}

describe('UsersList (Web v1)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard/users');
  });

  describe('columns and column picker', () => {
    it('shows name with email, roles, status and last sign-in by default', async () => {
      await renderList();

      const headers = within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent);
      expect(headers).toEqual([
        'Name',
        'Roles',
        'Status',
        'Last sign-in',
        'Actions',
      ]);

      const ada = rowFor('Ada Lovelace');
      expect(within(ada).getByText('ada@example.com')).toBeInTheDocument();
      expect(within(ada).getByText('admin')).toBeInTheDocument();
      expect(within(ada).queryByText('+1 555 0100')).not.toBeInTheDocument();
    });

    it('reveals phone, failed attempts, created and password changed from the column picker', async () => {
      await renderList();

      await user.click(screen.getByRole('button', { name: 'Columns' }));
      const options = screen.getAllByRole('menuitemcheckbox');
      expect(options.map((option) => option.textContent)).toEqual([
        'Phone',
        'Failed attempts',
        'Created',
        'Password changed',
      ]);
      options.forEach((option) =>
        expect(option).toHaveAttribute('aria-checked', 'false')
      );

      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Phone' }));
      await user.click(screen.getByRole('button', { name: 'Columns' }));
      await user.click(
        screen.getByRole('menuitemcheckbox', { name: 'Failed attempts' })
      );
      await user.click(screen.getByRole('button', { name: 'Columns' }));
      await user.click(
        screen.getByRole('menuitemcheckbox', { name: 'Created' })
      );
      await user.click(screen.getByRole('button', { name: 'Columns' }));
      await user.click(
        screen.getByRole('menuitemcheckbox', { name: 'Password changed' })
      );

      const headers = within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent);
      expect(headers).toEqual([
        'Name',
        'Roles',
        'Status',
        'Last sign-in',
        'Phone',
        'Failed attempts',
        'Created',
        'Password changed',
        'Actions',
      ]);
      const ada = rowFor('Ada Lovelace');
      expect(within(ada).getByText('+1 555 0100')).toBeInTheDocument();
      expect(within(ada).getByText('2')).toBeInTheDocument();
      expect(within(ada).getByText('Mar 4, 2026')).toBeInTheDocument();
      expect(within(ada).getByText('May 6, 2026')).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it('shows badges only for exceptions, with glossary labels', async () => {
      await renderList();

      const statusOf = (name: string) =>
        within(rowFor(name)).queryAllByText(
          /^(Locked|Pending|Disabled|Active|Verified|Inactive|Unverified)$/
        );

      expect(statusOf('Ada Lovelace')).toHaveLength(0);
      expect(statusOf('Marcus Webb').map((el) => el.textContent)).toEqual([
        'Locked',
      ]);
      expect(statusOf('Hannah Lindqvist').map((el) => el.textContent)).toEqual([
        'Pending',
      ]);
      expect(statusOf('Aisha Karim').map((el) => el.textContent)).toEqual([
        'Disabled',
      ]);
    });
  });
});
