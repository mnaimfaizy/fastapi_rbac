from sqlalchemy import Boolean, cast, desc, func, select
from sqlmodel.ext.asyncio.session import AsyncSession  # Use SQLModel's AsyncSession

from app.models.permission_model import Permission
from app.models.role_model import Role
from app.models.user_model import User

# Assuming you have a way to track active sessions, e.g., via a separate model or Redis.
# For this example, we'll mock active sessions or assume it's handled elsewhere.


async def get_total_users_count(
    db: AsyncSession,
) -> int:  # Changed Session to AsyncSession
    result = await db.execute(select(func.count(User.__table__.c.id)))
    return result.scalar_one_or_none() or 0


async def get_total_roles_count(
    db: AsyncSession,
) -> int:  # Changed Session to AsyncSession
    result = await db.execute(select(func.count(Role.__table__.c.id)))
    return result.scalar_one_or_none() or 0


async def get_total_permissions_count(
    db: AsyncSession,
) -> int:  # Changed Session to AsyncSession
    result = await db.execute(select(func.count(Permission.__table__.c.id)))
    return result.scalar_one_or_none() or 0


async def get_active_sessions_count(
    db: AsyncSession,
) -> int:  # Changed Session to AsyncSession
    # Placeholder: Actual implementation depends on how sessions are tracked.
    # This might involve querying a session table, checking Redis, or an audit log.
    # For now, returning a mock value or a count of recently active users.
    # Example: Count users active in the last X minutes (if User model has `last_login_at`)
    # from datetime import datetime, timedelta
    # five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)
    # result = await db.execute(select(func.count(User.id)).filter(User.last_login_at > five_minutes_ago))
    # return result.scalar_one_or_none() or 0
    return 0  # Replace with actual logic


async def get_recent_logins(
    db: AsyncSession, limit: int = 5
) -> list[User]:  # Changed Session to AsyncSession
    # Assuming User model has a 'last_login_at' or similar field.
    # If not, this needs to be adapted based on how login activity is tracked.
    # For demonstration, let's assume 'updated_at' can serve as a proxy if 'last_login_at' doesn't exist.
    # Or, if you have an audit log table for logins, query that instead.
    stmt = None
    if hasattr(User, "last_login_at") and User.last_login_at is not None:
        stmt = select(User).order_by(desc(User.last_login_at)).limit(limit)
    elif hasattr(User, "updated_at") and User.updated_at is not None:  # Fallback
        stmt = select(User).order_by(desc(User.updated_at)).limit(limit)

    if stmt is not None:
        result = await db.execute(stmt)
        items = result.scalars().all()
        return items
    return []


async def get_system_users_summary(
    db: AsyncSession, limit: int = 10, offset: int = 0
) -> list[User]:  # Changed Session to AsyncSession
    # Returns a list of users for the DataTable.
    # You might want to add pagination, filtering, sorting in a real app.
    stmt = select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return items


async def get_active_users_count(db: AsyncSession) -> int:
    """Return the count of users where is_active=True."""
    result = await db.execute(select(func.count()).select_from(User).where(cast(User.is_active, Boolean)))
    return result.scalar_one_or_none() or 0
