// react-frontend/src/models/dashboard.ts
export interface DashboardStats {
  total_users?: number;
  total_roles?: number;
  total_permissions?: number;
  active_sessions?: number;
}

export interface RecentLoginUser {
  id: string;
  name: string;
  email: string;
  lastActive: string;
}

export interface UserSummaryForTable {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_logins?: RecentLoginUser[];
  system_users_summary?: UserSummaryForTable[];
}
