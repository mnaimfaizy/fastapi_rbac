from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_users: Optional[int] = None
    total_roles: Optional[int] = None
    total_permissions: Optional[int] = None
    active_sessions: Optional[int] = None
    # Add more stats as needed


class RecentLoginUser(BaseModel):
    id: UUID
    name: str
    email: str
    last_active: str  # Or a datetime object, adjust as per actual data source


class UserSummaryForTable(BaseModel):
    id: UUID
    name: str
    email: str
    role: str  # This might be a simplified role name or list of roles
    status: str  # e.g., 'active', 'inactive'
    last_active: str


class DashboardData(BaseModel):
    stats: DashboardStats
    recent_logins: Optional[List[RecentLoginUser]] = None
    system_users_summary: Optional[List[UserSummaryForTable]] = None  # For the DataTable
    # Add other role-specific data sections


class IDashboardResponseData(BaseModel):
    stats: DashboardStats
    recent_logins: Optional[List[RecentLoginUser]] = None
    system_users_summary: Optional[List[UserSummaryForTable]] = None


class IDashboardResponse(BaseModel):
    data: IDashboardResponseData
    message: str = "Dashboard data retrieved successfully"

    class Config:
        orm_mode = True
