import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser } from './test-utils';
import RolesContent from '../features/roles/RolesContent';
import RoleDetail from '../features/roles/RoleDetail';
import { roleService } from '../services/role.service';
import permissionService from '../services/permission.service';
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
    info: vi.fn(),
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

function stamp(name: string) {
  return {
    id: `perm-${name}`,
    name,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

const roles = [
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Manager with user and content management permissions',
    role_group_id: 'group-ops',
    user_count: 8,
    permissions: [stamp('user.read')],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-archive',
    name: 'Archive',
    description: 'Unused role',
    user_count: 0,
    permissions: [],
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

function page<T>(items: T[]) {
  return {
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
  };
}

describe('Typed-name role delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getRoles.mockResolvedValue(page(roles));
    mockRoleService.getRoleById.mockResolvedValue({
      data: roles[0],
      message: 'ok',
      meta: {},
    });
    mockRoleService.deleteRole.mockResolvedValue(undefined);
    mockPermissionService.getPermissions.mockResolvedValue(page([]));
    mockRoleGroupService.getRoleGroups.mockResolvedValue(
      page([
        {
          id: 'group-ops',
          name: 'Operational',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])
    );
  });

  it('asks an admin to type the name when the role has holders', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(ADMIN_PERMISSIONS),
    });

    await user.click(
      await screen.findByRole('button', { name: 'Actions for Manager' })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Delete role' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete role ‘Manager’?',
    });
    expect(dialog).toHaveAccessibleDescription(
      '8 users hold this role. They’ll lose its 1 permission. Anyone without another role can only sign in and see their own profile.'
    );
    const confirm = within(dialog).getByRole('button', { name: 'Delete role' });
    expect(confirm).toBeDisabled();

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Type Manager to confirm' }),
      'manager'
    );
    expect(confirm).toBeDisabled();
    await user.clear(
      within(dialog).getByRole('textbox', { name: 'Type Manager to confirm' })
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Type Manager to confirm' }),
      'Manager'
    );
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(mockRoleService.deleteRole).toHaveBeenCalledWith('role-manager');
    });
  });

  it('uses a plain confirm when the role has no holders', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(ADMIN_PERMISSIONS),
    });

    await user.click(
      await screen.findByRole('button', { name: 'Actions for Archive' })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Delete role' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete role ‘Archive’?',
    });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete role' })
    );

    await waitFor(() => {
      expect(mockRoleService.deleteRole).toHaveBeenCalledWith('role-archive');
    });
  });

  it('hides delete from a manager and from a user on the list', async () => {
    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(MANAGER_PERMISSIONS),
    });
    expect(
      await screen.findByRole('link', { name: 'Manager' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Actions for/ })
    ).not.toBeInTheDocument();

    renderWithProviders(<RolesContent />, {
      preloadedState: viewer(USER_PERMISSIONS),
    });
    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete role' })
    ).not.toBeInTheDocument();
  });

  it('requires the typed name on role detail and a plain confirm when nobody holds it', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/dashboard/roles/role-manager');
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer(ADMIN_PERMISSIONS) }
    );

    await user.click(
      await screen.findByRole('button', { name: 'Delete role' })
    );
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Delete role' });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Type Manager to confirm' }),
      'Manager'
    );
    await user.click(confirm);
    await waitFor(() => {
      expect(mockRoleService.deleteRole).toHaveBeenCalledWith('role-manager');
    });
  });

  it('confirms a holder-free role on the detail page without typing', async () => {
    const user = userEvent.setup();
    mockRoleService.getRoleById.mockResolvedValue({
      data: roles[1],
      message: 'ok',
      meta: {},
    });
    window.history.pushState({}, '', '/dashboard/roles/role-archive');
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer(ADMIN_PERMISSIONS) }
    );

    await user.click(
      await screen.findByRole('button', { name: 'Delete role' })
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete role ‘Archive’?',
    });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete role' })
    );
    await waitFor(() => {
      expect(mockRoleService.deleteRole).toHaveBeenCalledWith('role-archive');
    });
  });

  it('keeps the role page and delete dialog mounted when delete is rejected', async () => {
    const user = userEvent.setup();
    const message =
      "Role 'Manager' has associated permissions and cannot be deleted. Please remove permissions first.";
    mockRoleService.deleteRole.mockRejectedValue({
      response: { data: { message } },
      message: 'Request failed',
    });
    window.history.pushState({}, '', '/dashboard/roles/role-manager');
    renderWithProviders(
      <Routes>
        <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
      </Routes>,
      { preloadedState: viewer(ADMIN_PERMISSIONS) }
    );

    await user.click(
      await screen.findByRole('button', { name: 'Delete role' })
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Type Manager to confirm' }),
      'Manager'
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete role' })
    );

    // The dialog stays open, so the page behind it is aria-hidden.
    expect(
      await screen.findByRole('alert', { hidden: true })
    ).toHaveTextContent(message);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Manager',
        hidden: true,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete role',
      })
    ).toBeEnabled();
  });

  it.each([
    ['manager', MANAGER_PERMISSIONS],
    ['user', USER_PERMISSIONS],
  ])(
    'does not offer delete on role detail to a %s',
    async (label, permissionNames) => {
      window.history.pushState({}, '', '/dashboard/roles/role-manager');
      renderWithProviders(
        <Routes>
          <Route path="/dashboard" element={<p>Signed-in home</p>} />
          <Route path="/dashboard/roles/:roleId" element={<RoleDetail />} />
        </Routes>,
        { preloadedState: viewer(permissionNames) }
      );

      if (label === 'user') {
        expect(await screen.findByText('Signed-in home')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Delete role' })
        ).not.toBeInTheDocument();
        return;
      }

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Manager' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Delete role' })
      ).not.toBeInTheDocument();
    }
  );
});
