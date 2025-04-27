import api from "./api";
import {
  RoleGroup,
  RoleGroupCreate,
  RoleGroupResponse,
  RoleGroupUpdate,
} from "../models/roleGroup";
import { PaginatedDataResponse, PaginationParams } from "../models/pagination";

const API_URL = "/role-groups";

const roleGroupService = {
  // Fetch paginated role groups
  getRoleGroups: async (
    params: PaginationParams = { page: 1, size: 10 }
  ): Promise<PaginatedDataResponse<RoleGroup>> => {
    const response = await api.get<PaginatedDataResponse<RoleGroup>>(API_URL, {
      params,
    });
    return response.data;
  },

  // Fetch a single role group by ID
  getRoleGroupById: async (groupId: string): Promise<RoleGroupResponse> => {
    const response = await api.get<RoleGroupResponse>(`${API_URL}/${groupId}`);
    return response.data;
  },

  // Create a new role group
  createRoleGroup: async (
    groupData: RoleGroupCreate
  ): Promise<RoleGroupResponse> => {
    const response = await api.post<RoleGroupResponse>(API_URL, groupData);
    return response.data;
  },

  // Update an existing role group
  updateRoleGroup: async (
    groupId: string,
    groupData: RoleGroupUpdate
  ): Promise<RoleGroupResponse> => {
    const response = await api.put<RoleGroupResponse>(
      `${API_URL}/${groupId}`,
      groupData
    );
    return response.data;
  },

  // Delete a role group by ID
  deleteRoleGroup: async (groupId: string): Promise<void> => {
    await api.delete(`${API_URL}/${groupId}`);
    // No content is returned on success (204)
  },

  // Add roles to a role group
  addRolesToGroup: async (
    groupId: string,
    roleIds: string[]
  ): Promise<RoleGroupResponse> => {
    const response = await api.post<RoleGroupResponse>(
      `${API_URL}/${groupId}/roles`,
      { role_ids: roleIds }
    );
    return response.data;
  },

  // Remove roles from a role group
  removeRolesFromGroup: async (
    groupId: string,
    roleIds: string[]
  ): Promise<RoleGroupResponse> => {
    const response = await api.delete<RoleGroupResponse>(
      `${API_URL}/${groupId}/roles`,
      { data: { role_ids: roleIds } }
    );
    return response.data;
  },
};

export default roleGroupService;
