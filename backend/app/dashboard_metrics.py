"""Counts and lists the admin and manager dashboards read.

The endpoint decides which of these a caller may see. This module only queries.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, cast, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.audit_log_model import AuditLog
from app.models.permission_group_model import PermissionGroup
from app.models.permission_model import Permission
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role
from app.models.user_model import User
from app.models.user_role_model import UserRole

SIGN_IN_ACTION = "successful_login"
SIGN_IN_LIMIT = 10


@dataclass(frozen=True)
class RoleShare:
    name: str
    count: int


@dataclass(frozen=True)
class SignInRow:
    id: UUID
    name: str
    email: str
    signed_in_at: datetime


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _naive_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _display_name(first_name: str | None, last_name: str | None, email: str) -> str:
    name = " ".join(part for part in (first_name, last_name) if part).strip()
    return name or email


async def _count(db: AsyncSession, statement: object) -> int:
    # ``exec`` yields a Row for ``func.count()``, not a bare int.
    value = (await db.exec(statement)).one()  # type: ignore[arg-type]
    if not isinstance(value, int):
        value = value[0]  # type: ignore[index]
    return int(value or 0)


async def count_users(db: AsyncSession) -> int:
    return await _count(db, select(func.count()).select_from(User))


async def count_active_users(db: AsyncSession) -> int:
    return await _count(
        db,
        select(func.count()).select_from(User).where(cast(User.is_active, Boolean).is_(True)),
    )


async def count_locked_users(db: AsyncSession) -> int:
    """Accounts sign-in would still refuse: locked, and the window has not passed."""
    now = _naive_utc_now()
    return await _count(
        db,
        select(func.count())
        .select_from(User)
        .where(
            cast(User.is_locked, Boolean).is_(True),
            User.locked_until.is_not(None),
            User.locked_until > now,
        ),
    )


async def count_roles(db: AsyncSession) -> int:
    return await _count(db, select(func.count()).select_from(Role))


async def count_role_groups(db: AsyncSession) -> int:
    return await _count(db, select(func.count()).select_from(RoleGroup))


async def count_permissions(db: AsyncSession) -> int:
    return await _count(db, select(func.count()).select_from(Permission))


async def count_permission_groups(db: AsyncSession) -> int:
    return await _count(db, select(func.count()).select_from(PermissionGroup))


async def role_distribution(db: AsyncSession) -> list[RoleShare]:
    """One count per role a user holds. A user in two roles is counted in each, once."""
    statement = (
        select(Role.name, func.count(UserRole.user_id))
        .join(UserRole, UserRole.role_id == Role.id)
        .group_by(Role.id, Role.name)
        .order_by(Role.name)
    )
    rows = (await db.exec(statement)).all()
    shares: list[RoleShare] = []
    for name, count in rows:
        if not name:
            continue
        shares.append(RoleShare(name=str(name), count=int(count)))
    return shares


async def recent_sign_ins(db: AsyncSession, limit: int = SIGN_IN_LIMIT) -> list[SignInRow]:
    """The newest ``successful_login`` events joined to the user who signed in."""
    statement = (
        select(AuditLog.timestamp, User.id, User.first_name, User.last_name, User.email)
        .join(User, User.id == AuditLog.actor_id)
        .where(AuditLog.action == SIGN_IN_ACTION)
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    rows = (await db.exec(statement)).all()
    sign_ins: list[SignInRow] = []
    for timestamp, user_id, first_name, last_name, email in rows:
        sign_ins.append(
            SignInRow(
                id=user_id,
                name=_display_name(first_name, last_name, email),
                email=email,
                signed_in_at=_as_utc(timestamp),
            )
        )
    return sign_ins
