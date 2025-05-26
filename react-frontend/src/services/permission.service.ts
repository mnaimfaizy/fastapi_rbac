import api from './api';
import {
  PermissionCreate,
  PermissionGroupCreate,
  PermissionGroupResponse,
  PermissionGroupUpdate,
  PermissionResponse,
  PaginatedPermissionResponse,
  PaginatedPermissionGroupResponse,
} from '../models/permission';

const PERMISSION_BASE_URL = '/permissions';
const PERMISSION_GROUP_BASE_URL = '/permission-groups';

class PermissionService {
  // Permission endpoints
  async getPermissions(page = 1, size = 10) {
    const response = await api.get<PaginatedPermissionResponse>(
      `${PERMISSION_BASE_URL}?page=${page}&size=${size}`
    );
    return response.data;
  }

  async getPermissionById(id: string) {
    const response = await api.get<PermissionResponse>(
      `${PERMISSION_BASE_URL}/${id}`
    );
    return response.data;
  }

  async createPermission(permission: PermissionCreate) {
    const response = await api.post<PermissionResponse>(
      `${PERMISSION_BASE_URL}`,
      permission
    );
    return response.data;
  }

  async deletePermission(id: string) {
    try {
      await api.delete(`${PERMISSION_BASE_URL}/${id}`);
      return { success: true };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.data) {
        // Use the detail field directly if it exists
        if (error.response.data.detail) {
          throw new Error(error.response.data.detail);
        }
        // Otherwise use the message field
        if (error.response.data.message) {
          throw new Error(error.response.data.message);
        }
      }
      throw error; // Rethrow the original error to preserve stack trace
    }
  }

  // Permission Group endpoints
  async getPermissionGroups(page = 1, size = 10) {
    const response = await api.get<PaginatedPermissionGroupResponse>(
      `${PERMISSION_GROUP_BASE_URL}?page=${page}&size=${size}`
    );
    return response.data;
  }

  async getPermissionGroupById(id: string) {
    const response = await api.get<PermissionGroupResponse>(
      `${PERMISSION_GROUP_BASE_URL}/${id}`
    );
    return response.data;
  }

  async createPermissionGroup(group: PermissionGroupCreate) {
    const response = await api.post<PermissionGroupResponse>(
      `${PERMISSION_GROUP_BASE_URL}`,
      group
    );
    return response.data;
  }

  async updatePermissionGroup(id: string, group: PermissionGroupUpdate) {
    const response = await api.put<PermissionGroupResponse>(
      `${PERMISSION_GROUP_BASE_URL}/${id}`,
      group
    );
    return response.data;
  }

  async deletePermissionGroup(id: string) {
    try {
      await api.delete(`${PERMISSION_GROUP_BASE_URL}/${id}`);
      return { success: true };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.response?.data) {
        // Use the detail field directly if it exists
        if (error.response.data.detail) {
          throw new Error(error.response.data.detail);
        }
        // Otherwise use the message field
        if (error.response.data.message) {
          throw new Error(error.response.data.message);
        }
      }
      throw new Error('Failed to delete permission group');
    }
  }
}

export default new PermissionService();
