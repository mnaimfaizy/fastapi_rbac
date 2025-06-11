import { Permission } from './permission';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  is_locked: boolean;
  locked_until: string | null;
  needs_to_change_password: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
  expiry_date: string | null;
  last_changed_password_date: string | null;
  contact_phone: string | null;
  number_of_failed_attempts: number | null;
  verification_code: string | null;
  last_updated_by: string | null;
  roles: Role[];
  permissions?: string[];
  role_id?: string[] | Permission[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
  created_at?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  message: string;
  meta: Record<string, unknown>;
  data: T;
  success?: boolean;
}

export interface PaginatedItems<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
  previous_page: number | null;
  next_page: number | null;
}
