import { Role } from "./role";

// Basic role group interface
export interface RoleGroup {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  created_by_id?: string;
}

// Role group with related roles
export interface RoleGroupWithRoles extends RoleGroup {
  roles: Role[];
}

// Interface for creating a new role group
export interface RoleGroupCreate {
  name: string;
}

// Interface for updating a role group
export interface RoleGroupUpdate {
  name: string;
}

// API response interfaces
export interface RoleGroupResponse {
  message: string;
  meta: Record<string, unknown>;
  data: RoleGroup;
}

export interface RoleGroupWithRolesResponse {
  message: string;
  meta: Record<string, unknown>;
  data: RoleGroupWithRoles;
}
