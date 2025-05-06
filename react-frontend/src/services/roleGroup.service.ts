import api from "./api";
import {
  RoleGroup,
  RoleGroupCreate,
  RoleGroupResponse,
  RoleGroupUpdate,
  RoleGroupWithRolesResponse,
} from "../models/roleGroup";
import { PaginatedDataResponse, PaginationParams } from "../models/pagination";

const API_URL = "/role-groups";

const roleGroupService = {
  // Fetch paginated role groups with hierarchy
  getRoleGroups: async (
    params: PaginationParams = { page: 1, size: 10 }
  ): Promise<PaginatedDataResponse<RoleGroup>> => {
    const response = await api.get<PaginatedDataResponse<RoleGroup>>(API_URL, {
      params: { ...params, include_hierarchy: true },
    });
    return response.data;
  },

  // Fetch a single role group by ID with full details
  getRoleGroupById: async (
    groupId: string
  ): Promise<RoleGroupWithRolesResponse> => {
    const response = await api.get<RoleGroupWithRolesResponse>(
      `${API_URL}/${groupId}`,
      {
        params: {
          include_hierarchy: true,
          include_roles: true,
          include_children: true,
          include_nested_roles: true, // Add this parameter to ensure nested roles are included
          deep: true,
        },
      }
    );
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
  },

  // Add roles to a role group
  addRolesToGroup: async (
    groupId: string,
    roleIds: string[]
  ): Promise<RoleGroupWithRolesResponse> => {
    const response = await api.post<RoleGroupWithRolesResponse>(
      `${API_URL}/${groupId}/roles`,
      { role_ids: roleIds }
    );
    return response.data;
  },

  // Remove roles from a role group
  removeRolesFromGroup: async (
    groupId: string,
    roleIds: string[]
  ): Promise<RoleGroupWithRolesResponse> => {
    const response = await api.delete<RoleGroupWithRolesResponse>(
      `${API_URL}/${groupId}/roles`,
      { data: { role_ids: roleIds } }
    );
    return response.data;
  },

  // Get children of a role group
  getChildren: async (groupId: string): Promise<RoleGroupResponse> => {
    const response = await api.get<RoleGroupResponse>(
      `${API_URL}/${groupId}/children`
    );
    return response.data;
  },

  // Move role group to a new parent
  moveToParent: async (
    groupId: string,
    parentId: string | null
  ): Promise<RoleGroupResponse> => {
    const response = await api.put<RoleGroupResponse>(
      `${API_URL}/${groupId}/parent`,
      { parent_id: parentId }
    );
    return response.data;
  },
};

export default roleGroupService;
