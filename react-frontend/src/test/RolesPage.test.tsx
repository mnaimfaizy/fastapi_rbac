import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockUser } from './test-utils';
import RolesContent from '../features/roles/RolesContent';
import { roleService } from '../services/role.service';
import roleGroupService from '../services/roleGroup.service';

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

vi.mock('../services/roleGroup.service', () => ({
  default: {
    getRoleGroups: vi.fn(),
  },
}));

const mockRoleService = vi.mocked(roleService);
const mockRoleGroupService = vi.mocked(roleGroupService);

const MANAGER_PERMISSIONS = [
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
];

const USER_PERMISSIONS = [
  'self.read_profile',
  'self.update_profile',
  'self.read_roles',
  'self.read_permissions',
  'content.read_article',
];

function permissions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `perm-${count}-${index}`,
    name: `sample.read_${index}`,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }));
}

const roles = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full access to users, roles and permissions',
    role_group_id: 'group-admin',
    permissions: permissions(29),
    user_count: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Manager with user and content management permissions',
    role_group_id: 'group-ops',
    permissions: permissions(15),
    user_count: 8,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-user',
    name: 'User',
    description: 'Standard access to own profile and content',
    role_group_id: 'group-standard',
    permissions: permissions(5),
    user_count: 64,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

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

describe('Roles list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getRoles.mockResolvedValue({
      data: {
        items: roles,
        total: roles.length,
        page: 1,
        size: 10,
        pages: 1,
        next_page: null,
        previous_page: null,
      },
      message: 'ok',
      meta: {},
    });
    mockRoleGroupService.getRoleGroups.mockResolvedValue({
      data: {
        items: [
          {
            id: 'group-admin',
            name: 'Administrative',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'group-ops',
            name: 'Operational',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'group-standard',
            name: 'StandardUser',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 3,
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
    vi.restoreAllMocks();
  });

  it('shows name, description, role group, counts and actions for an admin', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer([
        ...MANAGER_PERMISSIONS,
        'role.create',
        'role.update',
        'role.delete',
      ]),
    });

    const table = await screen.findByRole('table');
    expect(
      screen.getByRole('columnheader', { name: 'Name' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Description' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Role group' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Permissions' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Users' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create role' })
    ).toBeInTheDocument();

    const managerRow = within(table)
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Manager'));
    expect(managerRow).toBeTruthy();
    expect(
      within(managerRow as HTMLElement).getByText(
        'Manager with user and content management permissions'
      )
    ).toBeInTheDocument();
    expect(
      within(managerRow as HTMLElement).getByText('Operational')
    ).toBeInTheDocument();
    expect(
      within(managerRow as HTMLElement).getByText('15')
    ).toBeInTheDocument();
    expect(
      within(managerRow as HTMLElement).getByText('8')
    ).toBeInTheDocument();
    expect(
      within(managerRow as HTMLElement).getByRole('link', { name: 'Manager' })
    ).toHaveAttribute('href', '/dashboard/roles/role-manager');

    await user.click(
      screen.getByRole('button', { name: 'Actions for Manager' })
    );
    expect(
      screen.getByRole('menuitem', { name: 'Edit role' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Delete role' })
    ).toBeInTheDocument();
  });

  it('shows a manager the list with no edit or delete controls', async () => {
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(MANAGER_PERMISSIONS),
    });

    expect(
      await screen.findByRole('link', { name: 'Manager' })
    ).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Create role' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Actions for/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Edit role' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete role' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('hides the roles table from a user who cannot read roles', async () => {
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(USER_PERMISSIONS),
    });

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Create role' })
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockRoleService.getRoles).not.toHaveBeenCalled();
    });
  });
});
