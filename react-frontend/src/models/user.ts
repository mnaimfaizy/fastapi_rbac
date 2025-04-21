export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  needsToChangePassword: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
  expiry_date: string;
  last_changed_password_date: string;
  contact_phone: string | null;
  number_of_failed_attempts: number | null;
  verification_code: string | null;
  last_updated_by: string | null;
  roles?: Role[];
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  message: string;
  meta: Record<string, unknown>;
  data: T;
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
