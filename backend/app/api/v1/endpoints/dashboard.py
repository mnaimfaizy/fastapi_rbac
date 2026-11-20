from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app import dashboard_metrics
from app.api import deps
from app.models.user_model import User
from app.schemas.dashboard_schema import (
    DashboardStats,
    IDashboardResponse,
    IDashboardResponseData,
    RecentSignIn,
    RoleCount,
)

router = APIRouter()

_USER_METRICS = "user.read"
_ROLE_METRICS = "role.read"
_ROLE_GROUP_METRICS = "role_group.read"
_PERMISSION_METRICS = "permission.read"
_PERMISSION_GROUP_METRICS = "permission_group.read"

# A superuser skips route permission checks. Treat them as holding every metric.
_ALL_METRICS = {
    _USER_METRICS,
    _ROLE_METRICS,
    _ROLE_GROUP_METRICS,
    _PERMISSION_METRICS,
    _PERMISSION_GROUP_METRICS,
}


def _permission_names(user: User) -> set[str]:
    if user.is_superuser:
        return set(_ALL_METRICS)
    names: set[str] = set()
    for role in user.roles or []:
        for permission in role.permissions or []:
            if permission.name:
                names.add(permission.name)
    return names


@router.get("", response_model=IDashboardResponse)
async def get_dashboard_data(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user()),
) -> IDashboardResponse:
    """Dashboard metrics the caller is allowed to see. Missing permission is null, not zero."""
    granted = _permission_names(current_user)
    stats = DashboardStats()
    distribution: list[RoleCount] | None = None
    sign_ins: list[RecentSignIn] | None = None

    if _USER_METRICS in granted:
        stats.total_users = await dashboard_metrics.count_users(db)
        stats.active_users = await dashboard_metrics.count_active_users(db)
        stats.locked_users = await dashboard_metrics.count_locked_users(db)
        sign_ins = [
            RecentSignIn(
                id=row.id,
                name=row.name,
                email=row.email,
                signed_in_at=row.signed_in_at,
            )
            for row in await dashboard_metrics.recent_sign_ins(db)
        ]

    if _ROLE_METRICS in granted:
        stats.total_roles = await dashboard_metrics.count_roles(db)
        distribution = [
            RoleCount(name=share.name, count=share.count)
            for share in await dashboard_metrics.role_distribution(db)
        ]

    if _ROLE_GROUP_METRICS in granted:
        stats.total_role_groups = await dashboard_metrics.count_role_groups(db)

    if _PERMISSION_METRICS in granted:
        stats.total_permissions = await dashboard_metrics.count_permissions(db)

    if _PERMISSION_GROUP_METRICS in granted:
        stats.total_permission_groups = await dashboard_metrics.count_permission_groups(db)

    return IDashboardResponse(
        data=IDashboardResponseData(
            stats=stats,
            role_distribution=distribution,
            recent_sign_ins=sign_ins,
        )
    )


@router.get("/stats", response_model=IDashboardResponse)
async def get_dashboard_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user()),
) -> IDashboardResponse:
    """Same payload as ``GET /dashboard``. Permissions decide the fields, not the role name."""
    return await get_dashboard_data(db=db, current_user=current_user)
