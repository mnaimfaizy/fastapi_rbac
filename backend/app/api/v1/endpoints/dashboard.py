from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.crud import crud_dashboard
from app.models.user_model import User
from app.schemas.dashboard_schema import (
    DashboardStats,
    IDashboardResponse,
    IDashboardResponseData,
    RecentLoginUser,
    UserSummaryForTable,
)
from app.schemas.role_schema import IRoleEnum  # For role checking

router = APIRouter()


@router.get("", response_model=IDashboardResponse)
async def get_dashboard_data(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user()),
) -> IDashboardResponse:
    """
    Retrieve dashboard data.
    Data returned will vary based on the user's role.
    """
    stats = DashboardStats()
    recent_logins_data: List[RecentLoginUser] = []
    system_users_summary_data: List[UserSummaryForTable] = []

    # Admin users get all stats
    # Non-admin users might get a subset or different stats
    # This logic can be expanded significantly based on requirements

    is_admin = any(role.name.lower() == IRoleEnum.admin.lower() for role in current_user.roles)

    if is_admin:
        stats.total_users = await crud_dashboard.get_total_users_count(db)
        stats.total_roles = await crud_dashboard.get_total_roles_count(db)
        stats.total_permissions = await crud_dashboard.get_total_permissions_count(
            db
        )  # Ensure this crud exists
        stats.active_sessions = await crud_dashboard.get_active_sessions_count(db)  # Placeholder

        db_recent_logins = await crud_dashboard.get_recent_logins(db, limit=5)
        for user_login in db_recent_logins:
            recent_logins_data.append(
                RecentLoginUser(
                    id=user_login.id,
                    name=f"{user_login.first_name} {user_login.last_name}".strip(),
                    email=user_login.email,
                    last_active=(
                        user_login.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                        if user_login.updated_at
                        else "N/A"
                    ),  # Or last_login_at
                )
            )

        db_system_users = await crud_dashboard.get_system_users_summary(db, limit=10)
        for user_obj in db_system_users:
            # Determine a simplified role string, e.g., the first role name or 'Multiple'
            role_name = user_obj.roles[0].name if user_obj.roles else "N/A"
            system_users_summary_data.append(
                UserSummaryForTable(
                    id=user_obj.id,
                    name=f"{user_obj.first_name} {user_obj.last_name}".strip(),
                    email=user_obj.email,
                    role=role_name,
                    status=("active" if user_obj.is_active else "inactive"),  # Assuming is_active field
                    last_active=(
                        user_login.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                        if user_login.updated_at
                        else "N/A"
                    ),
                )
            )
    else:
        # For non-admin users, provide limited or specific stats
        # Example: Only their own activity or team-specific data (if applicable)
        stats.total_users = await crud_dashboard.get_total_users_count(db)  # Or a more restricted count
        # Potentially hide other stats or show user-specific ones
        # stats.active_sessions = await crud_dashboard.get_active_sessions_count_for_user(db, current_user.id)

        # Non-admins might not see recent logins of others or system user summary

    dashboard_response_data = IDashboardResponseData(
        stats=stats,
        recent_logins=recent_logins_data if is_admin else None,  # Only for admin
        system_users_summary=(system_users_summary_data if is_admin else None),  # Only for admin
    )
    return IDashboardResponse(data=dashboard_response_data)
