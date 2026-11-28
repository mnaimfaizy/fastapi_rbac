from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.dashboard_metrics import SIGN_IN_ACTIONS
from app.models.audit_log_model import AuditLog
from app.models.user_model import User


async def last_sign_ins(db_session: AsyncSession, user_ids: Sequence[UUID]) -> dict[UUID, datetime]:
    """
    Newest sign-in time per user, read from audit events (#454).

    A sign-in is a ``successful_login`` or ``oauth2_successful_login`` event,
    the same rule the dashboard's Recent sign-ins uses. A failed login does not
    count. Users with no sign-in event are absent from the result. Times are
    tz-aware UTC: AuditLog stores naive UTC, and a bare ISO string would be read
    as local time in the browser.
    """
    if not user_ids:
        return {}
    statement = (
        select(col(AuditLog.actor_id), func.max(col(AuditLog.timestamp)))
        .where(col(AuditLog.actor_id).in_(user_ids), col(AuditLog.action).in_(SIGN_IN_ACTIONS))
        .group_by(col(AuditLog.actor_id))
    )
    rows = (await db_session.exec(statement)).all()  # type: ignore[call-overload]
    result: dict[UUID, datetime] = {}
    for actor_id, newest in rows:
        if actor_id is None or newest is None:
            continue
        result[actor_id] = (
            newest.replace(tzinfo=timezone.utc) if newest.tzinfo is None else newest.astimezone(timezone.utc)
        )
    return result


def serialize_user(user: User) -> dict[str, Any]:
    """
    Serialize a user object into a standardized dictionary format.
    This helper function provides consistent user serialization across endpoints.

    It carries no ``last_login_at``: a caller that has not looked up the sign-in
    time must not send ``null``, which would read as "never signed in". The users
    list and user read endpoints add the key themselves.
    """
    # Crucial: Ensure that user.roles and role.permissions are eagerly loaded
    # when the user object is fetched from the DB to avoid N+1 query problems here.
    # This might require using selectinload in your CRUD methods.
    user_permissions_set: set[str] = set()
    if user.roles:
        for role in user.roles:
            if hasattr(role, "permissions") and role.permissions:
                for perm in role.permissions:
                    if hasattr(perm, "name"):
                        user_permissions_set.add(perm.name)

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "needs_to_change_password": user.needs_to_change_password,
        "contact_phone": user.contact_phone,
        "last_changed_password_date": user.last_changed_password_date,
        "number_of_failed_attempts": user.number_of_failed_attempts,
        "is_locked": user.is_locked,
        "locked_until": user.locked_until,
        "verified": user.verified,
        "roles": (
            [{"id": str(role.id), "name": role.name, "description": role.description} for role in user.roles]
            if user.roles
            else []
        ),
        "permissions": sorted(list(user_permissions_set)),  # Add sorted list of unique permissions
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
