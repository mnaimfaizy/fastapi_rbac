/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roleService } from '../../services/role.service';
import api from '../../services/api';
import { Role, RoleCreate, RoleUpdate, RoleResponse } from '../../models/role';
import {
  PaginatedDataResponse,
  PaginationParams,
} from '../../models/pagination';

// Mock the API module
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

describe('RoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoles', () => {
    it('successfully retrieves paginated roles list', async () => {
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'admin',
          description: 'Administrator role',
          permissions: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'user',
          description: 'Regular user role',
          permissions: [],
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockPaginatedResponse: PaginatedDataResponse<Role> = {
        data: mockRoles,
        total: 2,
        page: 1,
        size: 10,
        pages: 1,
        success: true,
      };

      const mockResponse = {
        data: mockPaginatedResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const params: PaginationParams = { page: 1, size: 10 };
      const result = await roleService.getRoles(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/roles', { params });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('includes search parameter when provided', async () => {
      const mockPaginatedResponse: PaginatedDataResponse<Role> = {
        data: [],
        total: 0,
        page: 1,
        size: 10,
        pages: 0,
        success: true,
      };

      const mockResponse = {
        data: mockPaginatedResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const params: PaginationParams = { page: 1, size: 10, search: 'admin' };
      await roleService.getRoles(params);

      expect(mockedApi.get).toHaveBeenCalledWith('/roles', { params });
    });

    it('uses default pagination parameters when not provided', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 1,
          size: 10,
          pages: 0,
          success: true,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await roleService.getRoles();

      expect(mockedApi.get).toHaveBeenCalledWith('/roles', {
        params: { page: 1, size: 10 },
      });
    });
  });

  describe('getRoleById', () => {
    it('successfully retrieves role by ID', async () => {
      const mockRole: RoleResponse = {
        id: '123',
        name: 'admin',
        description: 'Administrator role with full permissions',
        permissions: [
          {
            id: 'perm1',
            name: 'user.create',
            description: 'Create users',
            group_id: 'group1',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockRole,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleService.getRoleById('123');

      expect(mockedApi.get).toHaveBeenCalledWith('/roles/123');
      expect(result).toEqual(mockRole);
    });

    it('handles role not found error', async () => {
      const mockError = new Error('Role not found');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(roleService.getRoleById('nonexistent')).rejects.toThrow(
        'Role not found'
      );
    });
  });

  describe('createRole', () => {
    it('successfully creates a new role', async () => {
      const mockRoleData: RoleCreate = {
        name: 'moderator',
        description: 'Moderator role',
        permission_ids: ['perm1', 'perm2'],
      };

      const mockCreatedRole: RoleResponse = {
        id: '456',
        name: 'moderator',
        description: 'Moderator role',
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockCreatedRole,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await roleService.createRole(mockRoleData);

      expect(mockedApi.post).toHaveBeenCalledWith('/roles', mockRoleData);
      expect(result).toEqual(mockCreatedRole);
    });

    it('handles duplicate role name error', async () => {
      const mockRoleData: RoleCreate = {
        name: 'admin', // Existing role name
        description: 'Another admin role',
        permission_ids: [],
      };

      const mockError = new Error('Role name already exists');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(roleService.createRole(mockRoleData)).rejects.toThrow(
        'Role name already exists'
      );
    });

    it('validates required name field', async () => {
      const invalidRoleData = {
        description: 'Role without name',
        permission_ids: [],
      } as RoleCreate;

      const mockError = new Error('Role name is required');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(roleService.createRole(invalidRoleData)).rejects.toThrow(
        'Role name is required'
      );
    });

    it('includes permission assignments in creation', async () => {
      const mockRoleData: RoleCreate = {
        name: 'content_manager',
        description: 'Content management role',
        permission_ids: ['content.create', 'content.update', 'content.delete'],
      };

      const mockResponse = {
        data: {} as RoleResponse,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await roleService.createRole(mockRoleData);

      expect(mockedApi.post).toHaveBeenCalledWith('/roles', mockRoleData);
    });
  });

  describe('updateRole', () => {
    it('successfully updates an existing role', async () => {
      const roleId = '123';
      const mockUpdateData: RoleUpdate = {
        name: 'super_admin',
        description: 'Super administrator role',
        permission_ids: ['all.permissions'],
      };

      const mockUpdatedRole: RoleResponse = {
        id: roleId,
        name: 'super_admin',
        description: 'Super administrator role',
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockUpdatedRole,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.put.mockResolvedValue(mockResponse);

      const result = await roleService.updateRole(roleId, mockUpdateData);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/roles/${roleId}`,
        mockUpdateData
      );
      expect(result).toEqual(mockUpdatedRole);
    });

    it('allows partial updates', async () => {
      const roleId = '123';
      const partialUpdate: RoleUpdate = {
        description: 'Updated description only',
      };

      const mockResponse = {
        data: {} as RoleResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.put.mockResolvedValue(mockResponse);

      await roleService.updateRole(roleId, partialUpdate);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/roles/${roleId}`,
        partialUpdate
      );
    });

    it('handles role not found during update', async () => {
      const mockError = new Error('Role not found');
      mockedApi.put.mockRejectedValue(mockError);

      await expect(roleService.updateRole('nonexistent', {})).rejects.toThrow(
        'Role not found'
      );
    });

    it('handles duplicate name during update', async () => {
      const mockError = new Error('Role name already exists');
      mockedApi.put.mockRejectedValue(mockError);

      await expect(
        roleService.updateRole('123', { name: 'existing_role' })
      ).rejects.toThrow('Role name already exists');
    });
  });

  describe('deleteRole', () => {
    it('successfully deletes a role', async () => {
      const roleId = '123';

      const mockResponse = {
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as any,
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      await roleService.deleteRole(roleId);

      expect(mockedApi.delete).toHaveBeenCalledWith(`/roles/${roleId}`);
    });

    it('handles role not found during deletion', async () => {
      const mockError = new Error('Role not found');
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(roleService.deleteRole('nonexistent')).rejects.toThrow(
        'Role not found'
      );
    });

    it('handles role in use error', async () => {
      const mockError = new Error(
        'Cannot delete role: role is assigned to users'
      );
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(roleService.deleteRole('123')).rejects.toThrow(
        'Cannot delete role: role is assigned to users'
      );
    });

    it('validates role ID parameter', async () => {
      await expect(roleService.deleteRole('')).rejects.toThrow();
    });
  });

  describe('assignPermissionsToRole', () => {
    it('successfully assigns permissions to role', async () => {
      const roleId = '123';
      const permissionIds = ['perm1', 'perm2'];

      const mockResponse = {
        data: {} as RoleResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await roleService.assignPermissionsToRole(roleId, permissionIds);

      expect(mockedApi.post).toHaveBeenCalledWith(
        `/roles/${roleId}/permissions`,
        { permission_ids: permissionIds }
      );
    });

    it('handles permission assignment error', async () => {
      const mockError = new Error('Permission assignment failed');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        roleService.assignPermissionsToRole('123', ['perm1'])
      ).rejects.toThrow('Permission assignment failed');
    });
  });

  describe('removePermissionsFromRole', () => {
    it('successfully removes permissions from role', async () => {
      const roleId = '123';
      const permissionIds = ['perm1', 'perm2'];

      const mockResponse = {
        data: {} as RoleResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      await roleService.removePermissionsFromRole(roleId, permissionIds);

      expect(mockedApi.delete).toHaveBeenCalledWith(
        `/roles/${roleId}/permissions`,
        { data: { permission_ids: permissionIds } }
      );
    });

    it('handles permission removal error', async () => {
      const mockError = new Error('Permission removal failed');
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(
        roleService.removePermissionsFromRole('123', ['perm1'])
      ).rejects.toThrow('Permission removal failed');
    });
  });

  describe('getAllRoles', () => {
    it('successfully retrieves all roles without pagination', async () => {
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'admin',
          description: 'Administrator',
          permissions: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'user',
          description: 'Regular user',
          permissions: [],
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockResponse = {
        data: mockRoles,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleService.getAllRoles();

      expect(mockedApi.get).toHaveBeenCalledWith('/roles/list');
      expect(result).toEqual(mockRoles);
    });

    it('handles empty roles list', async () => {
      const mockResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleService.getAllRoles();

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('preserves API error messages', async () => {
      const customError = new Error('Custom API error');
      mockedApi.get.mockRejectedValue(customError);

      await expect(roleService.getRoleById('123')).rejects.toThrow(
        'Custom API error'
      );
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedApi.get.mockRejectedValue(networkError);

      await expect(roleService.getRoles()).rejects.toThrow('Network Error');
    });

    it('handles unauthorized access errors', async () => {
      const unauthorizedError = new Error('Unauthorized');
      mockedApi.delete.mockRejectedValue(unauthorizedError);

      await expect(roleService.deleteRole('123')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('handles validation errors with field details', async () => {
      const validationError = new Error(
        'Validation failed: name field is required'
      );
      mockedApi.post.mockRejectedValue(validationError);

      await expect(roleService.createRole({} as RoleCreate)).rejects.toThrow(
        'Validation failed: name field is required'
      );
    });
  });

  describe('Service Instance', () => {
    it('exports the role service instance with all methods', () => {
      expect(roleService).toBeDefined();
      expect(typeof roleService.getRoles).toBe('function');
      expect(typeof roleService.getRoleById).toBe('function');
      expect(typeof roleService.createRole).toBe('function');
      expect(typeof roleService.updateRole).toBe('function');
      expect(typeof roleService.deleteRole).toBe('function');
      expect(typeof roleService.getAllRoles).toBe('function');
      expect(typeof roleService.assignPermissionsToRole).toBe('function');
      expect(typeof roleService.removePermissionsFromRole).toBe('function');
    });
  });

  describe('TypeScript Interfaces', () => {
    it('defines RoleCreate interface correctly', () => {
      const roleData: RoleCreate = {
        name: 'test_role',
        description: 'Test role description',
        permission_ids: ['perm1', 'perm2'],
      };

      expect(roleData.name).toBe('test_role');
      expect(roleData.permission_ids).toEqual(['perm1', 'perm2']);
    });

    it('defines RoleUpdate interface correctly', () => {
      const updateData: RoleUpdate = {
        description: 'Updated description',
        permission_ids: ['new_perm'],
      };

      expect(updateData.description).toBe('Updated description');
      expect(updateData.permission_ids).toEqual(['new_perm']);
    });
  });

  describe('URL Construction', () => {
    it('constructs correct URLs for all endpoints', async () => {
      const mockResponse = {
        data: { data: [], success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);
      mockedApi.post.mockResolvedValue(mockResponse);
      mockedApi.put.mockResolvedValue(mockResponse);
      mockedApi.delete.mockResolvedValue(mockResponse);

      // Test all endpoint URL constructions
      await roleService.getRoles({ page: 1, size: 10, search: 'search' });
      expect(mockedApi.get).toHaveBeenCalledWith('/roles', {
        params: { page: 1, size: 10, search: 'search' },
      });

      await roleService.getRoleById('123');
      expect(mockedApi.get).toHaveBeenCalledWith('/roles/123');

      await roleService.getAllRoles();
      expect(mockedApi.get).toHaveBeenCalledWith('/roles/list');

      await roleService.createRole({ name: 'test', description: 'test' });
      expect(mockedApi.post).toHaveBeenCalledWith('/roles', {
        name: 'test',
        description: 'test',
      });

      await roleService.updateRole('123', { name: 'updated' });
      expect(mockedApi.put).toHaveBeenCalledWith('/roles/123', {
        name: 'updated',
      });

      await roleService.deleteRole('123');
      expect(mockedApi.delete).toHaveBeenCalledWith('/roles/123');

      await roleService.assignPermissionsToRole('123', ['perm1']);
      expect(mockedApi.post).toHaveBeenCalledWith('/roles/123/permissions', {
        permission_ids: ['perm1'],
      });

      await roleService.removePermissionsFromRole('123', ['perm1']);
      expect(mockedApi.delete).toHaveBeenCalledWith('/roles/123/permissions', {
        data: { permission_ids: ['perm1'] },
      });
    });
  });
});
