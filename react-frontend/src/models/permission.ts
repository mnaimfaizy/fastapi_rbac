import { PaginatedResponse } from "./common";

export interface Permission {
  id: string;
  name: string;
  description?: string;
  group?: PermissionGroup;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  permission_group_id?: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  permissions?: Permission[];
  groups?: PermissionGroup[];
}

// Create/Update interfaces
export interface PermissionCreate {
  name: string;
  description?: string;
  group_id: string;
}

export interface PermissionUpdate {
  name?: string;
  description?: string;
  // While TypeScript marks this as optional, the backend database requires it
  // Always include this field in update requests
  group_id: string;
}

export interface PermissionGroupCreate {
  name: string;
  permission_group_id?: string | null;
}

export interface PermissionGroupUpdate {
  name?: string;
  permission_group_id?: string | null;
}

// API response interfaces
export interface PermissionResponse {
  data: Permission;
  message: string;
  meta: Record<string, unknown>;
}

export interface PermissionGroupResponse {
  data: PermissionGroup;
  message: string;
  meta: Record<string, unknown>;
}

export interface PaginatedPermissionResponse {
  data: PaginatedResponse<Permission>;
  message: string;
  meta: Record<string, unknown>;
}

export interface PaginatedPermissionGroupResponse {
  data: PaginatedResponse<PermissionGroup>;
  message: string;
  meta: Record<string, unknown>;
}

export interface PermissionGroupWithPermissions extends PermissionGroup {
  permissions: Permission[];
}
