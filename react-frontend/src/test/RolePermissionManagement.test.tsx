import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import RoleList from '../features/roles/RoleList';
import RoleForm from '../features/roles/RoleForm';
import PermissionsContent from '../features/permissions/PermissionsContent';
import { roleService } from '../services/role.service';
import permissionService from '../services/permission.service';
import { Role } from '../models/role';
import { Permission } from '../models/permission';
import { RoleGroup } from '../models/roleGroup';

// Mock services
vi.mock('../services/role.service');
vi.mock('../services/permission.service');
const mockRoleService = vi.mocked(roleService);
const mockPermissionService = vi.mocked(permissionService);

// Mock data
const mockPermissions: Permission[] = [
  {
    id: '1',
    name: 'user.read',
    description: 'Read user data',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'user.create',
    description: 'Create users',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'user.update',
    description: 'Update users',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'user.delete',
    description: 'Delete users',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'role.read',
    description: 'Read roles',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'role.create',
    description: 'Create roles',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const mockRoleGroups: RoleGroup[] = [
  {
    id: '1',
    name: 'System',
    parent_id: undefined,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Operations',
    parent_id: undefined,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const mockRoles: Role[] = [
  {
    id: '1',
    name: 'user',
    description: 'Regular user role',
    permissions: [mockPermissions[0]],
    role_group_id: undefined,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'admin',
    description: 'Administrator role',
    permissions: mockPermissions,
    role_group_id: undefined,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

describe('Role and Permission Management Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RoleList', () => {
    it('renders role list with correct data', async () => {
      mockRoleService.getRoles = vi.fn().mockResolvedValue({
        data: {
          data: mockRoles,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<RoleList />);

      await waitFor(() => {
        expect(screen.getByText('user')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
        expect(screen.getByText('Regular user role')).toBeInTheDocument();
        expect(screen.getByText('Administrator role')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching roles', () => {
      mockRoleService.getRoles = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      renderWithProviders(<RoleList />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('handles error state when fetching roles fails', async () => {
      mockRoleService.getRoles = vi
        .fn()
        .mockRejectedValue(new Error('Failed to fetch roles'));

      renderWithProviders(<RoleList />);

      await waitFor(() => {
        expect(screen.getByText(/error loading roles/i)).toBeInTheDocument();
      });
    });

    it('shows create role button for users with permissions', async () => {
      const adminState = {
        auth: {
          user: {
            id: '1',
            permissions: [
              { id: '6', name: 'role.create', description: 'Create roles' },
            ],
          },
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      mockRoleService.getRoles = vi.fn().mockResolvedValue({
        data: {
          data: mockRoles,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<RoleList />, { preloadedState: adminState });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /create role/i })
        ).toBeInTheDocument();
      });
    });

    it('displays permission count for each role', async () => {
      mockRoleService.getRoles = vi.fn().mockResolvedValue({
        data: {
          data: mockRoles,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<RoleList />);

      await waitFor(() => {
        expect(screen.getByText('1 permission')).toBeInTheDocument();
        expect(screen.getByText('6 permissions')).toBeInTheDocument();
      });
    });

    it('handles role deletion with confirmation', async () => {
      mockRoleService.getRoles = vi.fn().mockResolvedValue({
        data: {
          data: mockRoles,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      mockRoleService.deleteRole = vi.fn().mockResolvedValue({});

      const adminState = {
        auth: {
          user: {
            id: '1',
            permissions: [
              { id: '5', name: 'role.read', description: 'Read roles' },
              { id: '7', name: 'role.delete', description: 'Delete roles' },
            ],
          },
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      renderWithProviders(<RoleList />, { preloadedState: adminState });

      await waitFor(() => {
        expect(screen.getByText('user')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByTestId('delete-role-button');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/are you sure you want to delete/i)
        ).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockRoleService.deleteRole).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('RoleForm', () => {
    const mockOnSubmit = vi.fn();

    it('renders create role form with empty fields', () => {
      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      expect(screen.getByLabelText(/role name/i)).toHaveValue('');
      expect(screen.getByLabelText(/description/i)).toHaveValue('');
      expect(
        screen.getByRole('button', { name: /create role/i })
      ).toBeInTheDocument();
    });

    it('renders edit role form with pre-filled data', () => {
      renderWithProviders(
        <RoleForm
          onSubmit={mockOnSubmit}
          roleGroups={mockRoleGroups}
          initialData={mockRoles[0]}
        />
      );

      expect(screen.getByDisplayValue('user')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Regular user role')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save changes/i })
      ).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      const submitButton = screen.getByRole('button', { name: /create role/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/role name is required/i)).toBeInTheDocument();
      });
    });

    it('validates role name format', async () => {
      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      const nameInput = screen.getByLabelText(/role name/i);
      fireEvent.change(nameInput, { target: { value: 'Invalid Role Name!' } });

      const submitButton = screen.getByRole('button', { name: /create role/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/role name can only contain/i)
        ).toBeInTheDocument();
      });
    });

    it('shows available permissions for selection', async () => {
      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 100, total: 6, pages: 1 },
        },
      });

      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      await waitFor(() => {
        expect(screen.getByText('user.read')).toBeInTheDocument();
        expect(screen.getByText('user.create')).toBeInTheDocument();
        expect(screen.getByText('role.read')).toBeInTheDocument();
      });
    });

    it('allows permission selection and deselection', async () => {
      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 100, total: 6, pages: 1 },
        },
      });

      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      await waitFor(() => {
        const userReadCheckbox = screen.getByRole('checkbox', {
          name: /user\.read/i,
        });
        expect(userReadCheckbox).not.toBeChecked();
      });

      const userReadCheckbox = screen.getByRole('checkbox', {
        name: /user\.read/i,
      });
      fireEvent.click(userReadCheckbox);

      expect(userReadCheckbox).toBeChecked();

      fireEvent.click(userReadCheckbox);
      expect(userReadCheckbox).not.toBeChecked();
    });

    it('submits form with correct data', async () => {
      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 100, total: 6, pages: 1 },
        },
      });

      mockRoleService.createRole = vi.fn().mockResolvedValue({
        data: { id: '3', name: 'manager', description: 'Manager role' },
      });

      renderWithProviders(
        <RoleForm onSubmit={mockOnSubmit} roleGroups={mockRoleGroups} />
      );

      await waitFor(() => {
        expect(screen.getByText('user.read')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/role name/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      fireEvent.change(nameInput, { target: { value: 'manager' } });
      fireEvent.change(descriptionInput, { target: { value: 'Manager role' } });

      const userReadCheckbox = screen.getByRole('checkbox', {
        name: /user\.read/i,
      });
      fireEvent.click(userReadCheckbox);

      const submitButton = screen.getByRole('button', { name: /create role/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRoleService.createRole).toHaveBeenCalledWith({
          name: 'manager',
          description: 'Manager role',
          permission_ids: ['1'],
        });
      });
    });
  });

  describe('PermissionsContent', () => {
    it('renders permissions list with correct data', async () => {
      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 10, total: 6, pages: 1 },
        },
      });

      renderWithProviders(<PermissionsContent />);

      await waitFor(() => {
        expect(screen.getByText('user.read')).toBeInTheDocument();
        expect(screen.getByText('user.create')).toBeInTheDocument();
        expect(screen.getByText('Read user data')).toBeInTheDocument();
        expect(screen.getByText('Create users')).toBeInTheDocument();
      });
    });

    it('groups permissions by category', async () => {
      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 10, total: 6, pages: 1 },
        },
      });

      renderWithProviders(<PermissionsContent />);

      await waitFor(() => {
        expect(screen.getByText(/user permissions/i)).toBeInTheDocument();
        expect(screen.getByText(/role permissions/i)).toBeInTheDocument();
      });
    });

    it('allows filtering permissions by search term', async () => {
      mockPermissionService.getPermissions = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            data: mockPermissions,
            pagination: { page: 1, limit: 10, total: 6, pages: 1 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: mockPermissions.filter((p) => p.name.includes('user')),
            pagination: { page: 1, limit: 10, total: 4, pages: 1 },
          },
        });

      renderWithProviders(<PermissionsContent />);

      await waitFor(() => {
        expect(screen.getByText('role.read')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search permissions/i);
      fireEvent.change(searchInput, { target: { value: 'user' } });

      await waitFor(() => {
        expect(mockPermissionService.getPermissions).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
          search: 'user',
        });
      });
    });

    it('shows create permission button for users with permissions', async () => {
      const adminState = {
        auth: {
          user: {
            id: '1',
            permissions: [
              {
                id: '8',
                name: 'permission.create',
                description: 'Create permissions',
              },
            ],
          },
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: mockPermissions,
          pagination: { page: 1, limit: 10, total: 6, pages: 1 },
        },
      });

      renderWithProviders(<PermissionsContent />, {
        preloadedState: adminState,
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /create permission/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Permission Assignment', () => {
    it('shows current role assignments for permissions', async () => {
      const permissionsWithRoles = mockPermissions.map((p) => ({
        ...p,
        roles: p.name.includes('user')
          ? [mockRoles[0], mockRoles[1]]
          : [mockRoles[1]],
      }));

      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: permissionsWithRoles,
          pagination: { page: 1, limit: 10, total: 6, pages: 1 },
        },
      });

      renderWithProviders(<PermissionsContent />);

      await waitFor(() => {
        expect(screen.getByText('user, admin')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });

    it('highlights unused permissions', async () => {
      const permissionsWithRoles = [
        { ...mockPermissions[0], roles: [] },
        { ...mockPermissions[1], roles: [mockRoles[0]] },
      ];

      mockPermissionService.getPermissions = vi.fn().mockResolvedValue({
        data: {
          data: permissionsWithRoles,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<PermissionsContent />);

      await waitFor(() => {
        expect(screen.getByText(/unused/i)).toBeInTheDocument();
      });
    });
  });
});
