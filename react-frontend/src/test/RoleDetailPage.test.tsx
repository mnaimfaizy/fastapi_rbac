import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser } from './test-utils';
import RoleDetail from '../features/roles/RoleDetail';
import { roleService } from '../services/role.service';
import permissionService from '../services/permission.service';
import { toast } from 'sonner';

vi.mock('../services/role.service', () => ({
  roleService: {
    getRoles: vi.fn(),
    getRoleById: vi.fn(),
    deleteRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    assignPermissionsToRole: vi.fn(),
    removePermissionsFromRole: vi.fn(),
    getAllRoles: vi.fn(),
  },
}));

vi.mock('../services/permission.service', () => ({
  default: {
    getPermissions: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockRoleService = vi.mocked(roleService);
const mockPermissionService = vi.mocked(permissionService);

const GROUPS = [
  'User',
  'Role',
  'Permission',
  'Role Group',
  'Permission Group',
  'Self',
  'Content',
] as const;

const CATALOG: { group: string; action: string }[] = [
  ...['create', 'read', 'update', 'delete', 'manage_roles'].map((action) => ({
    group: 'User',
    action,
  })),
  ...['create', 'read', 'update', 'delete'].map((action) => ({
    group: 'Role',
    action,
  })),
  ...['create', 'read', 'update', 'delete'].map((action) => ({
    group: 'Permission',
    action,
  })),
  ...['create', 'read', 'update', 'delete'].map((action) => ({
    group: 'Role Group',
    action,
  })),
  ...['create', 'read', 'update', 'delete'].map((action) => ({
    group: 'Permission Group',
    action,
  })),
  ...['read_profile', 'update_profile', 'read_roles', 'read_permissions'].map(
    (action) => ({ group: 'Self', action })
  ),
  ...['create_article', 'read_article', 'update_article', 'delete_article'].map(
    (action) => ({ group: 'Content', action })
  ),
];

function code(group: string, action: string) {
  return `${group.toLowerCase().replace(/ /g, '_')}.${action}`;
}

const MANAGER_GRANTED = new Set([
  'user.create',
  'user.read',
  'user.update',
  'role.read',
  'permission.read',
  'role_group.read',
  'permission_group.read',
  'self.read_profile',
  'self.update_profile',
  'self.read_roles',
  'self.read_permissions',
  'content.create_article',
  'content.read_article',
  'content.update_article',
  'content.delete_article',
]);

function catalogPermissions() {
  return CATALOG.map((entry, index) => {
    const name = code(entry.group, entry.action);
    return {
      id: `perm-${index}`,
      name,
      description: name,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      group: {
        id: `group-${entry.group}`,
        name: entry.group,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    };
  });
}

const managerRole = {
  id: 'role-manager',
  name: 'Manager',
  description: 'Manager with user and content management permissions',
  role_group_id: 'group-ops',
  user_count: 2,
  created_at: '2026-01-12T00:00:00Z',
  updated_at: '2026-11-04T00:00:00Z',
  permissions: catalogPermissions().filter((permission) =>
    MANAGER_GRANTED.has(permission.name)
  ),
  users: [
    {
      id: 'user-qm',
      email: 'manager@fastapi-rbac.example',
      first_name: 'QA',
      last_name: 'Manager',
    },
    {
      id: 'user-mw',
      email: 'marcus.webb@fastapi-rbac.example',
      first_name: 'Marcus',
      last_name: 'Webb',
    },
  ],
};

function viewer(permissionNames: string[]) {
  return {
    auth: {
      user: {
        ...mockUser,
        is_superuser: false,
        permissions: permissionNames,
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      passwordChangeSuccess: false,
      passwordResetRequested: false,
      passwordResetSuccess: false,
    },
  };
}

function rowFor(group: string) {
  const row = screen
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByText(group));
  expect(row).toBeTruthy();
  return row as HTMLElement;
}

describe('Role detail', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/dashboard/roles/role-manager');
    vi.clearAllMocks();
    mockRoleService.getRoleById.mockResolvedValue({
      data: managerRole,
      message: 'ok',
      meta: {},
    });
    const items = catalogPermissions();
    mockPermissionService.getPermissions.mockResolvedValue({
      data: {
        items,
        total: items.length,
        page: 1,
        size: 100,
        pages: 1,
        next_page: null,
        previous_page: null,
      },
      message: 'ok',
      meta: {},
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('places Manager’s 15 seeded permissions in the right cells and lists holders', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer([...MANAGER_GRANTED]) }
    );

    expect(
      await screen.findByRole('columnheader', { name: 'Permission group' })
    ).toBeInTheDocument();
    for (const column of ['Create', 'Read', 'Update', 'Delete', 'Other']) {
      expect(
        screen.getByRole('columnheader', { name: column })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByText('15 of 29 granted, by permission group')
    ).toBeInTheDocument();

    const userRow = rowFor('User');
    expect(
      within(userRow).getByLabelText('user.create granted')
    ).toBeInTheDocument();
    expect(
      within(userRow).getByLabelText('user.read granted')
    ).toBeInTheDocument();
    expect(
      within(userRow).getByLabelText('user.update granted')
    ).toBeInTheDocument();
    expect(
      within(userRow).getByLabelText('user.delete not granted')
    ).toBeInTheDocument();
    expect(within(userRow).getByText('None granted')).toBeInTheDocument();
    expect(within(userRow).getByText('3/5')).toBeInTheDocument();

    const roleRow = rowFor('Role');
    expect(
      within(roleRow).getByLabelText('role.read granted')
    ).toBeInTheDocument();
    expect(
      within(roleRow).getByLabelText('role.create not granted')
    ).toBeInTheDocument();
    expect(
      within(roleRow).getByLabelText('role.update not granted')
    ).toBeInTheDocument();
    expect(
      within(roleRow).getByLabelText('role.delete not granted')
    ).toBeInTheDocument();

    const permissionRow = rowFor('Permission');
    expect(
      within(permissionRow).getByLabelText('permission.read granted')
    ).toBeInTheDocument();

    const roleGroupRow = rowFor('Role Group');
    expect(
      within(roleGroupRow).getByLabelText('role_group.read granted')
    ).toBeInTheDocument();

    const permissionGroupRow = rowFor('Permission Group');
    expect(
      within(permissionGroupRow).getByLabelText('permission_group.read granted')
    ).toBeInTheDocument();

    const selfRow = rowFor('Self');
    expect(within(selfRow).getByText('self.read_profile')).toBeInTheDocument();
    expect(within(selfRow).getByText('self.read_roles')).toBeInTheDocument();
    expect(
      within(selfRow).getByText('self.read_permissions')
    ).toBeInTheDocument();
    expect(
      within(selfRow).getByText('self.update_profile')
    ).toBeInTheDocument();
    expect(within(selfRow).getAllByLabelText('Not available')).toHaveLength(4);
    expect(within(selfRow).getByText('4/4')).toBeInTheDocument();

    const contentRow = rowFor('Content');
    expect(
      within(contentRow).getByLabelText('content.create_article granted')
    ).toBeInTheDocument();
    expect(
      within(contentRow).getByLabelText('content.read_article granted')
    ).toBeInTheDocument();
    expect(
      within(contentRow).getByLabelText('content.update_article granted')
    ).toBeInTheDocument();
    expect(
      within(contentRow).getByLabelText('content.delete_article granted')
    ).toBeInTheDocument();

    expect(GROUPS).toHaveLength(7);
    expect(screen.getByRole('link', { name: 'QA Manager' })).toHaveAttribute(
      'href',
      '/dashboard/users/user-qm'
    );
    expect(
      screen.getByText('manager@fastapi-rbac.example')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Marcus Webb' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Edit role' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Delete role/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Add Permissions/i })
    ).not.toBeInTheDocument();
  });

  it('lets an admin open edit from the detail page', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      {
        preloadedState: viewer([
          ...MANAGER_GRANTED,
          'role.update',
          'role.delete',
        ]),
      }
    );

    expect(
      await screen.findByRole('link', { name: 'Edit role' })
    ).toHaveAttribute('href', '/dashboard/roles/edit/role-manager');
    const deleteButton = screen.getByRole('button', { name: /Delete role/i });
    expect(deleteButton).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /More actions/i })
    ).not.toBeInTheDocument();

    await userEvent.click(deleteButton);
    const confirm = await within(
      await screen.findByRole('alertdialog')
    ).findByRole('button', { name: 'Delete role' });
    expect(confirm).toHaveClass('bg-destructive');
  });

  it('does not fetch the permission catalog without permission.read and labels the list as partial', async () => {
    const granted = [...MANAGER_GRANTED].filter((n) => n !== 'permission.read');
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer(granted) }
    );

    expect(
      await screen.findByText(/permissions granted \(partial list/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/of 29 granted/)).not.toBeInTheDocument();
    expect(mockPermissionService.getPermissions).not.toHaveBeenCalled();
  });

  it('labels the matrix as partial when the catalog is bigger than one page', async () => {
    const items = catalogPermissions();
    mockPermissionService.getPermissions.mockResolvedValue({
      data: {
        items,
        total: 250,
        page: 1,
        size: 100,
        pages: 3,
        next_page: 2,
        previous_page: null,
      },
      message: 'ok',
      meta: {},
    });
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer([...MANAGER_GRANTED]) }
    );

    expect(
      await screen.findByText(/permissions granted \(partial list/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/of 29 granted/)).not.toBeInTheDocument();
  });

  it('shows only the count when the API sends no holders (no user.read)', async () => {
    mockRoleService.getRoleById.mockResolvedValue({
      data: { ...managerRole, users: undefined },
      message: 'ok',
      meta: {},
    });
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer([...MANAGER_GRANTED]) }
    );

    expect(await screen.findByText('2 users')).toBeInTheDocument();
    expect(
      screen.getByText(/needs the user.read permission/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No users hold this role/)
    ).not.toBeInTheDocument();
  });

  it('says the holders list is capped when it is shorter than the count', async () => {
    mockRoleService.getRoleById.mockResolvedValue({
      data: { ...managerRole, user_count: 90 },
      message: 'ok',
      meta: {},
    });
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer([...MANAGER_GRANTED]) }
    );

    expect(
      await screen.findByText('Showing the first 2 of 90')
    ).toBeInTheDocument();
    expect(screen.getByText('90 users')).toBeInTheDocument();
    // The users list has no role filter, so there is no link to "all" holders.
    expect(
      screen.queryByRole('link', { name: /View all/ })
    ).not.toBeInTheDocument();
  });

  it('refuses the detail page to a user who cannot read roles', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      {
        preloadedState: viewer([
          'self.read_profile',
          'self.update_profile',
          'self.read_roles',
          'self.read_permissions',
          'content.read_article',
        ]),
      }
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'You do not have permission to view role details'
      );
    });
    expect(
      screen.queryByRole('columnheader', { name: 'Permission group' })
    ).not.toBeInTheDocument();
    expect(mockRoleService.getRoleById).not.toHaveBeenCalled();
  });
});
