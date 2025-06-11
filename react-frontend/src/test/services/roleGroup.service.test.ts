import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../../services/api';
import roleGroupService from '../../services/roleGroup.service';
import { RoleGroupCreate, RoleGroupUpdate } from '../../models/roleGroup';

// Mock the API module
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('RoleGroupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoleGroups', () => {
    it('successfully retrieves paginated role groups', async () => {
      const mockRoleGroups = [
        {
          id: '1',
          name: 'Admin Group',
          description: 'Administrative roles',
          parent_id: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'User Group',
          description: 'User roles',
          parent_id: '1',
          created_at: '2023-01-02T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      ];

      const mockResponse = {
        data: {
          data: mockRoleGroups,
          total: 2,
          page: 1,
          size: 10,
          pages: 1,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleGroupService.getRoleGroups();

      expect(mockedApi.get).toHaveBeenCalledWith('/role-groups', {
        params: { page: 1, size: 10, include_hierarchy: true },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('handles custom pagination parameters', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 2,
          size: 20,
          pages: 0,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await roleGroupService.getRoleGroups({ page: 2, size: 20 });

      expect(mockedApi.get).toHaveBeenCalledWith('/role-groups', {
        params: { page: 2, size: 20, include_hierarchy: true },
      });
    });

    it('handles API errors appropriately', async () => {
      const mockError = new Error('Failed to fetch role groups');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(roleGroupService.getRoleGroups()).rejects.toThrow(
        'Failed to fetch role groups'
      );
    });
  });

  describe('getRoleGroupById', () => {
    it('successfully retrieves a role group by ID', async () => {
      const groupId = '123';
      const mockRoleGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        parent_id: null,
        roles: [],
        children: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockRoleGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleGroupService.getRoleGroupById(groupId);

      expect(mockedApi.get).toHaveBeenCalledWith(`/role-groups/${groupId}`, {
        params: {
          include_hierarchy: true,
          include_roles: true,
          include_children: true,
          include_nested_roles: true,
          deep: true,
        },
      });
      expect(result).toEqual(mockRoleGroup);
    });

    it('handles role group not found error', async () => {
      const groupId = 'nonexistent';
      const mockError = new Error('Role group not found');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(roleGroupService.getRoleGroupById(groupId)).rejects.toThrow(
        'Role group not found'
      );
    });
  });

  describe('createRoleGroup', () => {
    it('successfully creates a new role group', async () => {
      const mockGroupData: RoleGroupCreate = {
        name: 'New Group',
        description: 'New group description',
        parent_id: null,
      };

      const mockCreatedGroup = {
        id: '456',
        name: 'New Group',
        description: 'New group description',
        parent_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse = {
        data: mockCreatedGroup,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {},
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await roleGroupService.createRoleGroup(mockGroupData);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/role-groups',
        mockGroupData
      );
      expect(result).toEqual(mockCreatedGroup);
    });

    it('handles duplicate role group name error', async () => {
      const mockGroupData: RoleGroupCreate = {
        name: 'Existing Group',
        description: 'Duplicate group',
        parent_id: null,
      };

      const mockError = new Error('Role group name already exists');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        roleGroupService.createRoleGroup(mockGroupData)
      ).rejects.toThrow('Role group name already exists');
    });
  });

  describe('updateRoleGroup', () => {
    it('successfully updates an existing role group', async () => {
      const groupId = '123';
      const mockUpdateData: RoleGroupUpdate = {
        description: 'Updated description',
      };

      const mockUpdatedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Updated description',
        parent_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockUpdatedGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.put.mockResolvedValue(mockResponse);

      const result = await roleGroupService.updateRoleGroup(
        groupId,
        mockUpdateData
      );

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/role-groups/${groupId}`,
        mockUpdateData
      );
      expect(result).toEqual(mockUpdatedGroup);
    });

    it('handles role group not found during update', async () => {
      const mockError = new Error('Role group not found');
      mockedApi.put.mockRejectedValue(mockError);

      await expect(
        roleGroupService.updateRoleGroup('nonexistent', {
          description: 'Updated',
        })
      ).rejects.toThrow('Role group not found');
    });
  });

  describe('deleteRoleGroup', () => {
    it('successfully deletes a role group', async () => {
      const groupId = '123';

      const mockResponse = {
        data: null,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {},
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      await roleGroupService.deleteRoleGroup(groupId);

      expect(mockedApi.delete).toHaveBeenCalledWith(`/role-groups/${groupId}`);
    });

    it('handles role group not found during deletion', async () => {
      const mockError = new Error('Role group not found');
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(
        roleGroupService.deleteRoleGroup('nonexistent')
      ).rejects.toThrow('Role group not found');
    });

    it('handles role group in use error', async () => {
      const mockError = new Error(
        'Role group has children and cannot be deleted'
      );
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(roleGroupService.deleteRoleGroup('123')).rejects.toThrow(
        'Role group has children and cannot be deleted'
      );
    });
  });

  describe('addRolesToGroup', () => {
    it('successfully adds roles to a role group', async () => {
      const groupId = '123';
      const roleIds = ['role1', 'role2'];

      const mockUpdatedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        parent_id: null,
        roles: [
          { id: 'role1', name: 'Role 1' },
          { id: 'role2', name: 'Role 2' },
        ],
        children: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockUpdatedGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await roleGroupService.addRolesToGroup(groupId, roleIds);

      expect(mockedApi.post).toHaveBeenCalledWith(
        `/role-groups/${groupId}/roles`,
        { role_ids: roleIds }
      );
      expect(result).toEqual(mockUpdatedGroup);
    });

    it('handles role assignment error', async () => {
      const mockError = new Error('Failed to assign roles to group');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        roleGroupService.addRolesToGroup('123', ['role1'])
      ).rejects.toThrow('Failed to assign roles to group');
    });
  });

  describe('removeRolesFromGroup', () => {
    it('successfully removes roles from a role group', async () => {
      const groupId = '123';
      const roleIds = ['role1'];

      const mockUpdatedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        parent_id: null,
        roles: [],
        children: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockUpdatedGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.delete.mockResolvedValue(mockResponse);

      const result = await roleGroupService.removeRolesFromGroup(
        groupId,
        roleIds
      );

      expect(mockedApi.delete).toHaveBeenCalledWith(
        `/role-groups/${groupId}/roles`,
        { data: { role_ids: roleIds } }
      );
      expect(result).toEqual(mockUpdatedGroup);
    });

    it('handles role removal error', async () => {
      const mockError = new Error('Failed to remove roles from group');
      mockedApi.delete.mockRejectedValue(mockError);

      await expect(
        roleGroupService.removeRolesFromGroup('123', ['role1'])
      ).rejects.toThrow('Failed to remove roles from group');
    });
  });

  describe('getChildren', () => {
    it('successfully retrieves children of a role group', async () => {
      const groupId = '123';
      const mockChildren = [
        {
          id: 'child1',
          name: 'Child Group 1',
          description: 'Child description',
          parent_id: groupId,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockResponse = {
        data: mockChildren,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleGroupService.getChildren(groupId);

      expect(mockedApi.get).toHaveBeenCalledWith(
        `/role-groups/${groupId}/children`
      );
      expect(result).toEqual(mockChildren);
    });

    it('handles no children found', async () => {
      const mockResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await roleGroupService.getChildren('123');

      expect(result).toEqual([]);
    });
  });

  describe('moveToParent', () => {
    it('successfully moves role group to a new parent', async () => {
      const groupId = '123';
      const parentId = 'parent456';

      const mockMovedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        parent_id: parentId,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockMovedGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.put.mockResolvedValue(mockResponse);

      const result = await roleGroupService.moveToParent(groupId, parentId);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/role-groups/${groupId}/parent`,
        { parent_id: parentId }
      );
      expect(result).toEqual(mockMovedGroup);
    });

    it('successfully moves role group to root level', async () => {
      const groupId = '123';

      const mockMovedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        parent_id: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse = {
        data: mockMovedGroup,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.put.mockResolvedValue(mockResponse);

      const result = await roleGroupService.moveToParent(groupId, null);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/role-groups/${groupId}/parent`,
        { parent_id: null }
      );
      expect(result).toEqual(mockMovedGroup);
    });

    it('handles circular reference error', async () => {
      const mockError = new Error('Cannot move group to its own child');
      mockedApi.put.mockRejectedValue(mockError);

      await expect(
        roleGroupService.moveToParent('123', 'child456')
      ).rejects.toThrow('Cannot move group to its own child');
    });
  });

  describe('Error Handling', () => {
    it('preserves API error messages', async () => {
      const customError = new Error('Custom API error');
      mockedApi.get.mockRejectedValue(customError);

      await expect(roleGroupService.getRoleGroups()).rejects.toThrow(
        'Custom API error'
      );
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedApi.get.mockRejectedValue(networkError);

      await expect(roleGroupService.getRoleGroups()).rejects.toThrow(
        'Network Error'
      );
    });

    it('handles unauthorized access errors', async () => {
      const unauthorizedError = new Error('Unauthorized');
      mockedApi.get.mockRejectedValue(unauthorizedError);

      await expect(roleGroupService.getRoleGroups()).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  describe('Service Instance', () => {
    it('exports the role group service with all required methods', () => {
      expect(roleGroupService).toBeDefined();
      expect(typeof roleGroupService.getRoleGroups).toBe('function');
      expect(typeof roleGroupService.getRoleGroupById).toBe('function');
      expect(typeof roleGroupService.createRoleGroup).toBe('function');
      expect(typeof roleGroupService.updateRoleGroup).toBe('function');
      expect(typeof roleGroupService.deleteRoleGroup).toBe('function');
      expect(typeof roleGroupService.addRolesToGroup).toBe('function');
      expect(typeof roleGroupService.removeRolesFromGroup).toBe('function');
      expect(typeof roleGroupService.getChildren).toBe('function');
      expect(typeof roleGroupService.moveToParent).toBe('function');
    });
  });

  describe('TypeScript Interfaces', () => {
    it('defines RoleGroupCreate interface correctly', () => {
      const createData: RoleGroupCreate = {
        name: 'test.group',
        description: 'Test group',
        parent_id: null,
      };

      expect(createData.name).toBe('test.group');
      expect(createData.parent_id).toBeNull();
    });

    it('defines RoleGroupUpdate interface correctly', () => {
      const updateData: RoleGroupUpdate = {
        description: 'Updated description',
      };

      expect(updateData.description).toBe('Updated description');
    });
  });
});
