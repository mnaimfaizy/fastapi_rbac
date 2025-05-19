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

export interface PermissionCreate {
  name: string;
  description?: string;
  group_id: string;
}

export interface PermissionGroupCreate {
  name: string;
  permission_group_id?: string | null;
}

// Keeping PermissionGroupUpdate for permission groups functionality
export interface PermissionGroupUpdate {
  name?: string;
  permission_group_id?: string | null;
}

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
  data: PaginatedData<Permission>;
  message: string;
  meta: Record<string, unknown>;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  next_page: number | null;
  previous_page: number | null;
}

export interface PaginatedPermissionGroupResponse {
  message: string;
  meta: Record<string, unknown>;
  data: PaginatedData<PermissionGroup>;
}

export interface PermissionGroupWithPermissions extends PermissionGroup {
  permissions: Permission[];
}
