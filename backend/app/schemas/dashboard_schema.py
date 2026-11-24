from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_users: Optional[int] = None
    active_users: Optional[int] = None
    total_roles: Optional[int] = None
    total_role_groups: Optional[int] = None
    total_permissions: Optional[int] = None
    total_permission_groups: Optional[int] = None
    locked_users: Optional[int] = None


class RoleCount(BaseModel):
    name: str
    count: int


class RecentSignIn(BaseModel):
    id: UUID
    name: str
    email: str
    signed_in_at: datetime


class IDashboardResponseData(BaseModel):
    stats: DashboardStats
    role_distribution: Optional[List[RoleCount]] = None
    recent_sign_ins: Optional[List[RecentSignIn]] = None


class IDashboardResponse(BaseModel):
    success: bool = True
    data: IDashboardResponseData
    message: str = "Dashboard data retrieved successfully"

    model_config = {"from_attributes": True}
