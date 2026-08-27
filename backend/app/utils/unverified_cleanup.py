"""Restart-safe cleanup of pending user accounts (#136).

Registration used to schedule an in-process ``asyncio.sleep`` of
``UNVERIFIED_ACCOUNT_CLEANUP_HOURS`` and delete the user when it woke. A sleep
that long does not survive a redeploy, a crash, or a worker restart, so every
pending row created before the last restart was kept forever — holding an email
address nobody could re-register.

This module replaces that with a sweep: a query for pending users older than the
window, run periodically by Celery Beat (``app.worker.cleanup_unverified_users_task``).
Its state lives in the database rather than in a coroutine, so a restart costs at
most one missed tick.

Who is swept: active, non-superuser users whose ``verified`` flag is still false
and whose ``created_at`` predates the window. That is ``AccountState.PENDING``
from :mod:`app.utils.account_email_dispatch` plus an age bound. Deactivated rows
are excluded because deactivation is a deliberate admin action, and superusers
because losing one locks everybody out of administration. Note that an
admin-created account left unverified is swept too when
``ADMIN_CREATED_USERS_AUTO_VERIFIED`` is off: nothing distinguishes it from a
self-registration in the schema.

A row that cannot be deleted — a foreign key this module does not clear, say —
is logged and left for the next tick rather than failing the batch.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import delete as sa_delete
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.password_history_model import UserPasswordHistory
from app.models.user_model import User
from app.models.user_role_model import UserRole

logger = logging.getLogger(__name__)

# Bounds one tick's work so a long-neglected table cannot produce a single
# enormous transaction. Beat runs hourly; the backlog drains over a few ticks.
DEFAULT_SWEEP_LIMIT = 500


def _pending_past_window(cutoff: datetime) -> list[Any]:
    """The one definition of "pending, and past the verification window".

    Both the select and the delete filter on it. Keeping it in one place is what
    makes the delete's re-check a genuine guard rather than a second predicate
    that can drift away from the first.
    """
    return [
        User.verified.is_(False),  # type: ignore[attr-defined]
        User.is_active.is_(True),  # type: ignore[attr-defined]
        User.is_superuser.is_(False),  # type: ignore[attr-defined]
        User.created_at < cutoff,  # type: ignore[operator]
    ]


def unverified_cutoff(*, hours: Optional[int] = None, now: Optional[datetime] = None) -> datetime:
    """The ``created_at`` before which a pending user is due for deletion.

    Returned naive in UTC to match how every timestamp is stored on these models.
    """
    window = settings.UNVERIFIED_ACCOUNT_CLEANUP_HOURS if hours is None else hours
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is not None:
        moment = moment.astimezone(timezone.utc).replace(tzinfo=None)
    return moment - timedelta(hours=window)


async def select_pending_user_ids(
    *,
    db_session: AsyncSession,
    cutoff: datetime,
    limit: int = DEFAULT_SWEEP_LIMIT,
) -> list[UUID]:
    """Ids of pending users whose verification window has run out."""
    statement = (
        select(User.id)  # type: ignore[call-overload]
        .where(*_pending_past_window(cutoff))
        .order_by(User.created_at)  # type: ignore[arg-type]
        .limit(limit)
    )
    result = await db_session.exec(statement)
    return list(result.all())


async def delete_if_still_pending(
    *,
    db_session: AsyncSession,
    user_id: UUID,
    cutoff: datetime,
) -> bool:
    """Delete one user, but only while the row still satisfies the sweep predicate.

    The predicate is repeated in the DELETE rather than trusted from the earlier
    SELECT: a user who clicks their verification link between the two must not be
    deleted, and two workers running the sweep at once must not both count the
    same row. The dependent rows go first because their foreign keys are not
    declared ``ON DELETE CASCADE``; if the guarded delete then matches nothing,
    the whole unit of work is rolled back and the row is untouched.

    Returns:
        True when this call deleted the user.
    """
    try:
        await db_session.exec(  # type: ignore[call-overload]
            sa_delete(UserPasswordHistory).where(UserPasswordHistory.user_id == user_id)
        )
        await db_session.exec(  # type: ignore[call-overload]
            sa_delete(UserRole).where(UserRole.user_id == user_id)
        )
        result = await db_session.exec(  # type: ignore[call-overload]
            sa_delete(User).where(User.id == user_id).where(*_pending_past_window(cutoff))
        )
        if result.rowcount == 0:
            await db_session.rollback()
            return False
        await db_session.commit()
        return True
    except Exception:
        await db_session.rollback()
        raise


async def sweep_unverified_users(
    *,
    db_session: AsyncSession,
    redis_client: Optional[Redis] = None,
    cleanup_hours: Optional[int] = None,
    now: Optional[datetime] = None,
    limit: int = DEFAULT_SWEEP_LIMIT,
) -> list[UUID]:
    """Delete pending users past the verification window.

    Safe to run concurrently with registration and with another copy of itself:
    each row is deleted under the guard in :func:`delete_if_still_pending`, and a
    row already gone is simply not counted. Running it on an empty backlog is a
    single SELECT.

    Args:
        db_session: Session the sweep owns; it commits per user.
        redis_client: Used to discard the pending verification token. Optional —
            the token expires on its own, so its absence must not stop the sweep.
        cleanup_hours: Override for ``UNVERIFIED_ACCOUNT_CLEANUP_HOURS``.
        now: Override for the current time, for tests.
        limit: Maximum users to delete in this pass.

    Returns:
        Ids of the users this pass deleted.
    """
    cutoff = unverified_cutoff(hours=cleanup_hours, now=now)
    candidates = await select_pending_user_ids(db_session=db_session, cutoff=cutoff, limit=limit)

    deleted: list[UUID] = []
    for user_id in candidates:
        try:
            removed = await delete_if_still_pending(db_session=db_session, user_id=user_id, cutoff=cutoff)
        except Exception:
            # One bad row must not cost the rest of the batch; the next tick
            # retries it.
            logger.exception("Failed to delete pending user %s", user_id)
            continue
        if not removed:
            continue
        deleted.append(user_id)
        # Per user, not just per batch: the deletion of an account is the kind of
        # thing an operator needs to be able to trace back to one id afterwards.
        logger.info("Deleted pending user %s, unverified since before %s", user_id, cutoff.isoformat())
        if redis_client is not None:
            try:
                await redis_client.delete(f"verification_token:{user_id}")
            except Exception:
                logger.warning("Could not discard verification token for %s", user_id, exc_info=True)

    if len(candidates) == limit:
        # A full batch means the backlog is at least one tick deep. Say so, or a
        # table growing faster than the sweep drains it looks exactly like a
        # healthy sweep from the logs.
        logger.warning("Pending-user sweep filled its batch of %d; more rows are likely still due", limit)
    return deleted
