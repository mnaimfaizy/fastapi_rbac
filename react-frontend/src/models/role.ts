import { Permission } from './permission';
import { User } from './user'; // Assuming User model exists

export interface Role {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  created_by?: User; // Optional: if backend populates this
  role_group_id?: string;
  permissions?: Permission[]; // Optional: if backend populates this
}

export interface RoleCreate {
  name: string;
  description?: string;
  role_group_id?: string;
  permission_ids?: string[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permission_ids?: string[];
}

// For API responses, assuming a standard structure like other models
export interface RoleResponse {
  data: Role;
  message: string;
  meta: Record<string, unknown>;
  id?: string; // Adding id for backward compatibility
  name?: string; // Adding name for backward compatibility
}

// For assigning permissions to a role
export interface RolePermissionAssign {
  permission_ids: string[];
}

// For removing permissions from a role
export interface RolePermissionUnassign {
  permission_ids: string[];
}
