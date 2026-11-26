import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser } from './test-utils';
import RoleFormContent from '../features/roles/RoleFormContent';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { roleService } from '../services/role.service';
import permissionService from '../services/permission.service';
import roleGroupService from '../services/roleGroup.service';
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

vi.mock('../services/roleGroup.service', () => ({
  default: {
    getRoleGroups: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockRoleService = vi.mocked(roleService);
const mockPermissionService = vi.mocked(permissionService);
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

const ADMIN_PERMISSIONS = [
  ...MANAGER_PERMISSIONS,
  'role.create',
  'role.update',
  'role.delete',
];

const CATALOG: { name: string; group: string }[] = [
  { name: 'user.read', group: 'User' },
  { name: 'user.delete', group: 'User' },
  { name: 'user.manage_roles', group: 'User' },
  { name: 'role.read', group: 'Role' },
  { name: 'role.update', group: 'Role' },
  { name: 'content.delete_article', group: 'Content' },
  { name: 'self.read_profile', group: 'Self' },
  { name: 'self.read_roles', group: 'Self' },
];

const SAVED = new Set([
  'user.read',
  'role.read',
  'content.delete_article',
  'self.read_profile',
]);

function permission(entry: { name: string; group: string }) {
  return {
    id: `perm-${entry.name}`,
    name: entry.name,
    description: entry.name,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    group: {
      id: `group-${entry.group}`,
      name: entry.group,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  };
}

const catalog = CATALOG.map(permission);

const managerRole = {
  id: 'role-manager',
  name: 'Manager',
  description: 'Keeps the books',
  role_group_id: 'group-ops',
  user_count: 8,
  created_at: '2026-01-12T00:00:00Z',
  updated_at: '2026-11-04T00:00:00Z',
  permissions: catalog.filter((entry) => SAVED.has(entry.name)),
};

const CEILING =
  "You cannot grant or remove the permission 'user.delete': you do not hold it.";

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

function roleResponse(role: typeof managerRole) {
  return { data: role, message: 'ok', meta: {} };
}

function renderEditor(path: string, permissionNames: string[]) {
  window.history.pushState({}, '', path);
  return renderWithProviders(
    <Routes>
      <Route
        path="/dashboard/roles/new"
        element={
          <ProtectedRoute requiredPermissions={['role.create']}>
            <RoleFormContent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/roles/edit/:roleId"
        element={
          <ProtectedRoute requiredPermissions={['role.update']}>
            <RoleFormContent />
          </ProtectedRoute>
        }
      />
    </Routes>,
    { preloadedState: viewer(permissionNames) }
  );
}

async function openEdit() {
  renderEditor('/dashboard/roles/edit/role-manager', ADMIN_PERMISSIONS);
  expect(
    await screen.findByRole('heading', { name: 'Edit role ‘Manager’' })
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('checkbox', { name: 'user.delete' })
  ).toBeInTheDocument();
}

describe('Permission matrix editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getRoleById.mockResolvedValue(roleResponse(managerRole));
    mockRoleService.createRole.mockResolvedValue(
      roleResponse({ ...managerRole, id: 'role-new', name: 'Auditor' })
    );
    mockRoleService.updateRole.mockResolvedValue(roleResponse(managerRole));
    mockRoleService.assignPermissionsToRole.mockResolvedValue(
      roleResponse(managerRole)
    );
    mockRoleService.removePermissionsFromRole.mockResolvedValue(
      roleResponse(managerRole)
    );
    mockPermissionService.getPermissions.mockResolvedValue({
      data: {
        items: catalog,
        total: catalog.length,
        page: 1,
        size: 100,
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
            id: 'group-ops',
            name: 'Operational',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
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

  it('updates the change count for an admin and discards without calling the API', async () => {
    const user = userEvent.setup();
    await openEdit();

    expect(
      screen.getByText(
        '8 users hold this role. Changes apply to them as soon as you save.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'user.read' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'user.delete' })
    ).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: 'user.manage_roles' })
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.queryByRole('checkbox', { name: 'user.manage_roles' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'self.read_profile' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'user.delete' }));

    expect(screen.getByRole('status')).toHaveTextContent('1 change');
    expect(screen.getByRole('checkbox', { name: 'user.delete' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'user.delete' })
    ).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'user.read' })).toBeChecked();
    expect(mockRoleService.assignPermissionsToRole).not.toHaveBeenCalled();
    expect(mockRoleService.removePermissionsFromRole).not.toHaveBeenCalled();
    expect(mockRoleService.updateRole).not.toHaveBeenCalled();
    expect(mockRoleService.createRole).not.toHaveBeenCalled();
  });

  it('selects a whole row and a whole column', async () => {
    const user = userEvent.setup();
    await openEdit();

    await user.click(
      screen.getByRole('checkbox', { name: 'Select all User permissions' })
    );

    expect(screen.getByRole('checkbox', { name: 'user.read' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'user.delete' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'user.manage_roles' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('2 changes');

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all Delete' })
    );

    expect(screen.getByRole('checkbox', { name: 'user.delete' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    ).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('1 change');
  });

  it('saves exactly the added and removed permission ids', async () => {
    const user = userEvent.setup();
    await openEdit();

    await user.click(screen.getByRole('checkbox', { name: 'user.delete' }));
    await user.click(screen.getByRole('checkbox', { name: 'role.update' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    );
    expect(screen.getByRole('status')).toHaveTextContent('3 changes');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockRoleService.assignPermissionsToRole).toHaveBeenCalledTimes(1);
    });
    expect(mockRoleService.assignPermissionsToRole).toHaveBeenCalledWith(
      'role-manager',
      ['perm-user.delete', 'perm-role.update']
    );
    expect(mockRoleService.removePermissionsFromRole).toHaveBeenCalledTimes(1);
    expect(mockRoleService.removePermissionsFromRole).toHaveBeenCalledWith(
      'role-manager',
      ['perm-content.delete_article']
    );
    expect(mockRoleService.updateRole).not.toHaveBeenCalled();
    expect(mockRoleService.createRole).not.toHaveBeenCalled();
  });

  it('sends a renamed role through updateRole and not the permission calls', async () => {
    const user = userEvent.setup();
    await openEdit();

    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'ManagerPlus');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mockRoleService.updateRole).toHaveBeenCalledTimes(1);
    });
    const payload = mockRoleService.updateRole.mock.calls[0][1];
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'ManagerPlus',
        description: 'Keeps the books',
      })
    );
    expect(payload).not.toHaveProperty('permission_ids');
    expect(mockRoleService.assignPermissionsToRole).not.toHaveBeenCalled();
    expect(mockRoleService.removePermissionsFromRole).not.toHaveBeenCalled();
  });

  it('shows a role-permission ceiling refusal instead of saving', async () => {
    const user = userEvent.setup();
    mockRoleService.assignPermissionsToRole.mockRejectedValue({
      response: { data: { message: CEILING } },
    });
    await openEdit();

    await user.click(screen.getByRole('checkbox', { name: 'user.delete' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(CEILING);
    expect(toast.error).toHaveBeenCalledWith(CEILING);
    expect(mockRoleService.removePermissionsFromRole).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Edit role ‘Manager’' })
    ).toBeInTheDocument();
  });

  it('reseeds the baseline from the last fulfilled save when a later call fails', async () => {
    const user = userEvent.setup();
    const renamed = { ...managerRole, name: 'ManagerPlus' };
    const afterAssign = {
      ...renamed,
      permissions: [
        ...managerRole.permissions,
        permission({ name: 'user.delete', group: 'User' }),
      ],
    };
    mockRoleService.updateRole.mockResolvedValue(roleResponse(renamed));
    mockRoleService.assignPermissionsToRole.mockResolvedValue(
      roleResponse(afterAssign)
    );
    mockRoleService.removePermissionsFromRole.mockRejectedValue({
      response: { data: { message: CEILING } },
    });

    await openEdit();
    const fetchesBeforeSave =
      mockPermissionService.getPermissions.mock.calls.length;

    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'ManagerPlus');
    await user.click(screen.getByRole('checkbox', { name: 'user.delete' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(CEILING);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled();
    });
    expect(mockPermissionService.getPermissions).toHaveBeenCalledTimes(
      fetchesBeforeSave
    );
    expect(
      screen.queryByText('Loading permissions...')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'ManagerPlus'
    );
    expect(screen.getByRole('checkbox', { name: 'user.delete' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    ).toBeChecked();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'user.delete' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 change');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(screen.getByRole('checkbox', { name: 'user.delete' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'content.delete_article' })
    ).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'ManagerPlus'
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mockRoleService.updateRole).toHaveBeenCalledTimes(1);
    expect(mockRoleService.assignPermissionsToRole).toHaveBeenCalledTimes(1);
    expect(mockRoleService.removePermissionsFromRole).toHaveBeenCalledTimes(1);
  });

  it('shows a role permission that the catalog page does not include', async () => {
    mockRoleService.getRoleById.mockResolvedValue(
      roleResponse({
        ...managerRole,
        permissions: [
          ...managerRole.permissions,
          permission({ name: 'audit.export', group: 'Audit' }),
        ],
      })
    );

    await openEdit();

    expect(
      screen.getByRole('button', { name: 'audit.export' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByText('Loading permissions...')
    ).not.toBeInTheDocument();
  });

  it('creates a role once with the selected permission ids', async () => {
    const user = userEvent.setup();
    renderEditor('/dashboard/roles/new', ADMIN_PERMISSIONS);

    expect(
      await screen.findByRole('heading', { name: 'Create role' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Name the role, then choose what it can do.')
    ).toBeInTheDocument();
    await screen.findByRole('checkbox', { name: 'user.read' });

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Auditor');
    await user.click(screen.getByRole('checkbox', { name: 'user.read' }));
    await user.click(screen.getByRole('checkbox', { name: 'role.read' }));
    expect(screen.getByText('2 of 8 permissions selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create role' }));

    await waitFor(() => {
      expect(mockRoleService.createRole).toHaveBeenCalledTimes(1);
    });
    expect(mockRoleService.createRole).toHaveBeenCalledWith({
      name: 'Auditor',
      permission_ids: ['perm-user.read', 'perm-role.read'],
    });
    expect(mockRoleService.assignPermissionsToRole).not.toHaveBeenCalled();
    expect(mockRoleService.removePermissionsFromRole).not.toHaveBeenCalled();
    expect(mockRoleService.getRoleById).not.toHaveBeenCalled();
  });

  it.each([
    [
      'manager',
      MANAGER_PERMISSIONS,
      '/dashboard/roles/edit/role-manager',
      'You can’t edit roles',
    ],
    [
      'user',
      USER_PERMISSIONS,
      '/dashboard/roles/edit/role-manager',
      'You can’t edit roles',
    ],
    [
      'manager',
      MANAGER_PERMISSIONS,
      '/dashboard/roles/new',
      'You can’t create roles',
    ],
    [
      'user',
      USER_PERMISSIONS,
      '/dashboard/roles/new',
      'You can’t create roles',
    ],
  ])(
    'does not open the editor for a %s at %s',
    async (_label, permissionNames, path, heading) => {
      renderEditor(path, permissionNames);
      expect(
        await screen.findByRole('heading', { name: heading })
      ).toBeInTheDocument();
      expect(mockRoleService.getRoleById).not.toHaveBeenCalled();
      expect(mockRoleService.createRole).not.toHaveBeenCalled();
    }
  );
});
