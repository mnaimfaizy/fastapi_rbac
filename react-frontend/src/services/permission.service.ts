import api from "./api";
import {
  Permission,
  PermissionCreate,
  PermissionGroup,
  PermissionGroupCreate,
  PermissionGroupResponse,
  PermissionGroupUpdate,
  PermissionResponse,
  PermissionUpdate,
  PaginatedPermissionResponse,
  PaginatedPermissionGroupResponse,
} from "../models/permission";

class PermissionService {
  // Permission endpoints
  async getPermissions(page = 1, size = 10) {
    const response = await api.get<PaginatedPermissionResponse>(
      `/permission?page=${page}&size=${size}`
    );
    return response.data;
  }

  async getPermissionById(id: string) {
    const response = await api.get<PermissionResponse>(`/permission/${id}`);
    return response.data;
  }

  async createPermission(permission: PermissionCreate) {
    const response = await api.post<PermissionResponse>(
      "/permission",
      permission
    );
    return response.data;
  }

  async updatePermission(id: string, permission: PermissionUpdate) {
    const response = await api.put<PermissionResponse>(
      `/permission/${id}`,
      permission
    );
    return response.data;
  }

  async deletePermission(id: string) {
    const response = await api.delete<PermissionResponse>(`/permission/${id}`);
    return response.data;
  }

  // Permission Group endpoints
  async getPermissionGroups(page = 1, size = 10) {
    const response = await api.get<PaginatedPermissionGroupResponse>(
      `/permission_group?page=${page}&size=${size}`
    );
    return response.data;
  }

  async getPermissionGroupById(id: string) {
    const response = await api.get<PermissionGroupResponse>(
      `/permission_group/${id}`
    );
    return response.data;
  }

  async createPermissionGroup(group: PermissionGroupCreate) {
    const response = await api.post<PermissionGroupResponse>(
      "/permission_group",
      group
    );
    return response.data;
  }

  async updatePermissionGroup(id: string, group: PermissionGroupUpdate) {
    const response = await api.put<PermissionGroupResponse>(
      `/permission_group/${id}`,
      group
    );
    return response.data;
  }

  async deletePermissionGroup(id: string) {
    const response = await api.delete<PermissionGroupResponse>(
      `/permission_group/${id}`
    );
    return response.data;
  }
}

export default new PermissionService();
