import { Role } from "./role";

// Basic user information for creator details
export interface UserBasic {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

// Basic role group interface
export interface RoleGroup {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  created_by_id?: string;
  creator?: UserBasic;
  parent_id?: string; // ID of the parent role group
  children?: RoleGroup[]; // Child role groups
}

// Role group with related roles
export interface RoleGroupWithRoles extends RoleGroup {
  roles: Role[];
  children: RoleGroupWithRoles[]; // Override children to include roles
  parent?: RoleGroupWithRoles; // Parent role group with roles
}

// Interface for creating a new role group
export interface RoleGroupCreate {
  name: string;
  parent_id?: string; // Optional parent group ID
}

// Interface for updating a role group
export interface RoleGroupUpdate {
  name?: string;
  parent_id?: string;
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
