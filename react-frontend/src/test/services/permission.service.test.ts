import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../../services/api';
import permissionService from '../../services/permission.service';
import { PermissionCreate } from '../../models/permission';

// Mock the API module
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

describe('PermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPermissions', () => {
    it('successfully retrieves paginated permissions list', async () => {
      const mockPermissions = [
        {
          id: '1',
          name: 'user.create',
          description: 'Create user permissions',
          group_id: 'group1',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'user.read',
          description: 'Read user permissions',
          group_id: 'group1',
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockResponse = {
        data: {
          data: mockPermissions,
          total: 2,
          page: 1,
          size: 10,
          pages: 1,
          success: true,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await permissionService.getPermissions();

      expect(mockedApi.get).toHaveBeenCalledWith('/permissions?page=1&size=10');
      expect(result).toEqual(mockResponse.data);
    });

    it('handles pagination parameters correctly', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 2,
          size: 20,
          pages: 0,
          success: true,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await permissionService.getPermissions(2, 20);

      expect(mockedApi.get).toHaveBeenCalledWith('/permissions?page=2&size=20');
    });

    it('handles API errors appropriately', async () => {
      const mockError = new Error('Failed to fetch permissions');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(permissionService.getPermissions()).rejects.toThrow(
        'Failed to fetch permissions'
      );
    });
  });

  describe('getPermissionById', () => {
    it('successfully retrieves a permission by ID', async () => {
      const permissionId = '123';
      const mockPermission = {
        id: permissionId,
        name: 'user.create',
        description: 'Create user permissions',
        group_id: 'group1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockPermission,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await permissionService.getPermissionById(permissionId);

      expect(mockedApi.get).toHaveBeenCalledWith(
        `/permissions/${permissionId}`
      );
      expect(result).toEqual(mockPermission);
    });

    it('handles permission not found error', async () => {
      const permissionId = 'nonexistent';
      const mockError = new Error('Permission not found');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(
        permissionService.getPermissionById(permissionId)
      ).rejects.toThrow('Permission not found');
    });
  });

  describe('createPermission', () => {
    it('successfully creates a new permission', async () => {
      const mockPermissionData: PermissionCreate = {
        name: 'role.create',
        description: 'Create role permissions',
        group_id: 'group2',
      };

      const mockCreatedPermission = {
        id: '456',
        name: 'role.create',
        description: 'Create role permissions',
        group_id: 'group2',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockCreatedPermission,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result =
        await permissionService.createPermission(mockPermissionData);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/permissions',
        mockPermissionData
      );
      expect(result).toEqual(mockCreatedPermission);
    });

    it('handles duplicate permission name error', async () => {
      const mockPermissionData: PermissionCreate = {
        name: 'user.create',
        description: 'Duplicate permission',
        group_id: 'group1',
      };

      const mockError = new Error('Permission name already exists');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        permissionService.createPermission(mockPermissionData)
      ).rejects.toThrow('Permission name already exists');
    });
  });

  describe('deletePermission', () => {
    it('successfully deletes a permission', async () => {
      const permissionId = '123';

      const mockResponse = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      const result = await permissionService.deletePermission(permissionId);

      expect(mockedApi.delete).toHaveBeenCalledWith(
        `/permissions/${permissionId}`
      );
      expect(result).toEqual({ success: true });
    });

    it('handles permission not found during deletion', async () => {
      const mockError = new Error('Permission not found');
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(
        permissionService.deletePermission('nonexistent')
      ).rejects.toThrow('Permission not found');
    });

    it('handles permission in use error', async () => {
      const mockError = new Error(
        'Permission is assigned to roles and cannot be deleted'
      );
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(permissionService.deletePermission('123')).rejects.toThrow(
        'Permission is assigned to roles and cannot be deleted'
      );
    });
  });

  describe('Error Handling', () => {
    it('preserves API error messages', async () => {
      const customError = new Error('Custom API error');
      mockedApi.get.mockRejectedValue(customError);

      await expect(permissionService.getPermissions()).rejects.toThrow(
        'Custom API error'
      );
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedApi.get.mockRejectedValue(networkError);

      await expect(permissionService.getPermissions()).rejects.toThrow(
        'Network Error'
      );
    });

    it('handles validation errors', async () => {
      const validationError = new Error('Validation failed: name is required');
      mockedApi.post.mockRejectedValue(validationError);

      await expect(
        permissionService.createPermission({} as PermissionCreate)
      ).rejects.toThrow('Validation failed: name is required');
    });
  });

  describe('Service Instance', () => {
    it('exports the permission service with all required methods', () => {
      expect(permissionService).toBeDefined();
      expect(typeof permissionService.getPermissions).toBe('function');
      expect(typeof permissionService.getPermissionById).toBe('function');
      expect(typeof permissionService.createPermission).toBe('function');
      expect(typeof permissionService.deletePermission).toBe('function');
    });
  });

  describe('TypeScript Interfaces', () => {
    it('defines PermissionCreate interface correctly', () => {
      const createData: PermissionCreate = {
        name: 'test.permission',
        description: 'Test permission',
        group_id: 'test-group',
      };

      expect(createData.name).toBe('test.permission');
      expect(createData.group_id).toBe('test-group');
    });
  });
});
