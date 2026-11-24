export interface DashboardStats {
  total_users?: number | null;
  active_users?: number | null;
  total_roles?: number | null;
  total_role_groups?: number | null;
  total_permissions?: number | null;
  total_permission_groups?: number | null;
  locked_users?: number | null;
}

export interface RoleCount {
  name: string;
  count: number;
}

export interface RecentSignIn {
  id: string;
  name: string;
  email: string;
  signed_in_at: string;
}

export interface DashboardData {
  stats: DashboardStats;
  role_distribution?: RoleCount[] | null;
  recent_sign_ins?: RecentSignIn[] | null;
}
