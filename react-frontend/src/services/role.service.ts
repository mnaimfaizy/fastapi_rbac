import api from "./api";
import { Role, RoleCreate, RoleResponse, RoleUpdate } from "../models/role";
import { PaginatedDataResponse, PaginationParams } from "../models/pagination";
import { ApiResponse } from "../models/user";

const API_URL = "/role";

export const roleService = {
  // Fetch paginated roles
  getRoles: async (
    params: PaginationParams = { page: 1, size: 10 }
  ): Promise<PaginatedDataResponse<Role>> => {
    const response = await api.get<PaginatedDataResponse<Role>>(API_URL, {
      params,
    });
    return response.data;
  },

  // Fetch a single role by ID
  getRoleById: async (roleId: string): Promise<RoleResponse> => {
    const response = await api.get<RoleResponse>(`${API_URL}/${roleId}`);
    return response.data;
  },

  // Create a new role
  createRole: async (roleData: RoleCreate): Promise<RoleResponse> => {
    const response = await api.post<RoleResponse>(API_URL, roleData);
    return response.data;
  },

  // Update an existing role
  updateRole: async (
    roleId: string,
    roleData: RoleUpdate
  ): Promise<RoleResponse> => {
    const response = await api.put<RoleResponse>(
      `${API_URL}/${roleId}`,
      roleData
    );
    return response.data;
  },

  // Delete a role by ID
  deleteRole: async (roleId: string): Promise<void> => {
    await api.delete(`${API_URL}/${roleId}`);
    // No content is returned on success (204)
  },

  // Assign permissions to a role
  assignPermissionsToRole: async (
    roleId: string,
    permissionIds: string[]
  ): Promise<RoleResponse> => {
    try {
      const response = await api.post<RoleResponse>(
        `${API_URL}/${roleId}/permissions`,
        { permission_ids: permissionIds }
      );
      return response.data;
    } catch (error) {
      console.error("Error assigning permissions to role:", error);
      throw error;
    }
  },

  // Remove permissions from a role
  removePermissionsFromRole: async (
    roleId: string,
    permissionIds: string[]
  ): Promise<RoleResponse> => {
    const response = await api.delete<RoleResponse>(
      `${API_URL}/${roleId}/permissions`,
      { data: { permission_ids: permissionIds } }
    );
    return response.data;
  },

  // Fetch ALL roles (no pagination)
  getAllRoles: async (): Promise<ApiResponse<Role[]>> => {
    const response = await api.get<ApiResponse<Role[]>>(`${API_URL}/list`);
    return response.data;
  },
};
