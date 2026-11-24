import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const MANAGER = ['user.read', 'user.create', 'user.update', 'role.read'];
// The seeded User role holds no user.* permission, so the route guard keeps
// a plain user out of this page; this is the narrowest viewer who gets in.
const READ_ONLY = ['user.read'];

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

  describe('search and filters', () => {
    const names = () =>
      within(table())
        .getAllByRole('link')
        .map((link) => link.textContent);

    async function pickFilter(label: string, option: string) {
      await user.click(screen.getByRole('button', { name: label }));
      await user.click(screen.getByRole('menuitemradio', { name: option }));
    }

    it('searches by name or email', async () => {
      await renderList();

      await user.type(
        screen.getByRole('searchbox', { name: 'Search users' }),
        'WEBB'
      );
      expect(names()).toEqual(['Marcus Webb']);

      await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
      await user.type(
        screen.getByRole('searchbox', { name: 'Search users' }),
        'hannah@'
      );
      expect(names()).toEqual(['Hannah Lindqvist']);
    });

    it('combines search, the role filter and the status filter', async () => {
      await renderList();

      await pickFilter('Filter by role', 'user');
      expect(names()).toEqual(['Hannah Lindqvist', 'Aisha Karim']);

      await pickFilter('Filter by status', 'Disabled');
      expect(names()).toEqual(['Aisha Karim']);
      expect(window.location.search).toBe('?status=Disabled');

      await user.type(
        screen.getByRole('searchbox', { name: 'Search users' }),
        'hannah'
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'No users match ‘hannah’' })
      ).toBeInTheDocument();
    });

    it('offers Clear search when nothing matches', async () => {
      await renderList();

      await user.type(
        screen.getByRole('searchbox', { name: 'Search users' }),
        'xyz'
      );
      expect(
        screen.getByRole('heading', { name: 'No users match ‘xyz’' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Check the spelling, or search by email instead.')
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear search' }));
      expect(
        screen.getByRole('searchbox', { name: 'Search users' })
      ).toHaveValue('');
      expect(names()).toHaveLength(listUsers.length);
    });

    it('reads the status filter from the URL', async () => {
      window.history.pushState({}, '', '/dashboard/users?status=locked');
      mockUserService.getUsers.mockResolvedValue(pageOf(listUsers));
      renderWithProviders(<UsersList />, { preloadedState: viewer(ADMIN) });

      await screen.findByText('marcus@example.com');
      expect(names()).toEqual(['Marcus Webb']);
      expect(
        screen.getByRole('button', { name: 'Filter by status' })
      ).toHaveTextContent('Status:Locked');

      await pickFilter('Filter by status', 'All');
      expect(names()).toHaveLength(listUsers.length);
      expect(window.location.search).toBe('');
    });

    it('ignores an unknown status in the URL', async () => {
      window.history.pushState({}, '', '/dashboard/users?status=Banned');
      await renderList();

      expect(names()).toHaveLength(listUsers.length);
    });

    it('shows the shared empty state when there are no users', async () => {
      await renderList(ADMIN, []);

      expect(
        await screen.findByRole('heading', { name: 'No users yet' })
      ).toBeInTheDocument();
      // The page header and the empty state both offer it.
      const addLinks = screen.getAllByRole('link', { name: 'Add user' });
      expect(addLinks).toHaveLength(2);
      addLinks.forEach((link) =>
        expect(link).toHaveAttribute('href', '/dashboard/users/new')
      );
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('row menu, row click and mobile', () => {
    async function openMenuFor(name: string) {
      await user.click(
        screen.getByRole('button', { name: `Actions for ${name}` })
      );
      return screen.getAllByRole('menuitem').map((item) => item.textContent);
    }

    it('gives an admin view, edit and delete', async () => {
      await renderList(ADMIN);

      expect(
        screen.getByRole('link', { name: 'Add user' })
      ).toBeInTheDocument();
      expect(await openMenuFor('Ada Lovelace')).toEqual([
        'View details',
        'Edit user',
        'Delete user',
      ]);
    });

    it('shows a manager without user.delete the list with no delete', async () => {
      await renderList(MANAGER);

      expect(within(table()).getAllByRole('row')).toHaveLength(
        listUsers.length + 1
      );
      expect(await openMenuFor('Ada Lovelace')).toEqual([
        'View details',
        'Edit user',
      ]);
    });

    it('gives a read-only viewer no add, edit or delete', async () => {
      await renderList(READ_ONLY);

      expect(
        screen.queryByRole('link', { name: 'Add user' })
      ).not.toBeInTheDocument();
      expect(await openMenuFor('Ada Lovelace')).toEqual(['View details']);
    });

    it('confirms before deleting, naming the user', async () => {
      mockUserService.deleteUser.mockResolvedValue(undefined);
      await renderList(ADMIN);

      await openMenuFor('Marcus Webb');
      await user.click(screen.getByRole('menuitem', { name: 'Delete user' }));
      const dialog = screen.getByRole('alertdialog', {
        name: 'Delete user ‘Marcus Webb’?',
      });
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete user' })
      );

      expect(mockUserService.deleteUser).toHaveBeenCalledWith('u-marcus');
    });

    it('opens the user when the row is clicked', async () => {
      await renderList();

      await user.click(
        within(rowFor('Ada Lovelace')).getByText('ada@example.com')
      );
      expect(window.location.pathname).toBe('/dashboard/users/u-ada');
    });

    it('keeps the row menu from opening the user', async () => {
      await renderList();

      await openMenuFor('Ada Lovelace');
      expect(window.location.pathname).toBe('/dashboard/users');
    });

    describe('on mobile', () => {
      const original = window.matchMedia;
      beforeEach(() => {
        window.matchMedia = ((query: string) => ({
          matches: query === '(max-width: 767px)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        })) as typeof window.matchMedia;
      });
      afterEach(() => {
        window.matchMedia = original;
      });

      it('shows stacked rows instead of the table', async () => {
        await renderList();

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Columns' })
        ).not.toBeInTheDocument();
        const rows = within(
          screen.getByRole('list', { name: 'Users' })
        ).getAllByRole('listitem');
        expect(rows).toHaveLength(listUsers.length);
        expect(within(rows[1]).getByText('Locked')).toBeInTheDocument();

        await user.click(within(rows[0]).getByText('ada@example.com'));
        expect(window.location.pathname).toBe('/dashboard/users/u-ada');
      });
    });
  });
});
