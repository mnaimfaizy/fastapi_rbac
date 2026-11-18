"""The only way a user becomes inactive (#281).

ADR 0011 decision 1 makes the allowlist the sole session revocation mechanism.
Setting ``is_active`` false on the row and leaving the allowlist alone would
make a later re-enable resurrect every unexpired session. This module ends
those sessions, and the emailed links that are not sessions, before the flag
changes.

A pending reset or verification link is not a session. ``sessions.end_all``
does not touch one; callers that must end one call ``emailed_links.revoke``
beside it. Disable and delete both do.
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user_model import User
from app.utils import emailed_links, sessions
from app.utils.background_tasks import log_security_event
from app.utils.emailed_links import LinkKind

logger = logging.getLogger(__name__)


async def end_sessions_and_emailed_links(user_id: UUID, *, redis_client: Redis) -> None:
    """End every allowlist session and every live emailed link for ``user_id``.

    Awaited inline, before the caller commits, so a response cannot leave
    while a session or a link is still live (#206).
    """
    await sessions.end_all(user_id, redis_client=redis_client)
    for kind in LinkKind:
        await emailed_links.revoke(kind, user_id, redis=redis_client)


async def disable_user(
    user: User,
    *,
    actor: Optional[User],
    db_session: AsyncSession,
    redis_client: Redis,
) -> User:
    """Set ``user.is_active`` false, or do nothing to the flag if it already is.

    This is the only place application code sets the flag false. In order: end every
    session and every emailed link, set the flag when the user was active,
    commit, then record ``user_disabled``. The audit row's actor is ``actor``
    (the acting administrator). The target's id is ``subject_user_id`` in the
    details, because ``log_security_event`` stores its ``user_id`` as the
    actor.

    Sessions end before the commit. If the commit fails the user is logged
    out and still active, which is the safe way to fail. An account that is
    already inactive still loses any session or link a direct database edit
    left behind, and does not gain a second ``user_disabled`` row. Running
    the demo-account retirement again depends on that.
    """
    user_id = user.id
    was_active = bool(user.is_active)
    try:
        await end_sessions_and_emailed_links(user_id, redis_client=redis_client)
        if was_active:
            # The only application-code assignment that deactivates a user.
            user.is_active = False
            db_session.add(user)
        await db_session.commit()
    except Exception:
        await db_session.rollback()
        try:
            await db_session.refresh(user)
        except Exception:
            logger.exception("Could not reload user %s after a failed disable", user_id)
        raise
    await db_session.refresh(user)
    if was_active:
        details: dict[str, str] = {"email": user.email, "subject_user_id": str(user.id)}
        if actor is not None:
            details["actor_id"] = str(actor.id)
        await log_security_event(
            background_tasks=BackgroundTasks(),
            event_type="user_disabled",
            user_id=actor.id if actor is not None else None,
            details=details,
            db_session=db_session,
        )
    return user


async def record_user_deleted(
    *,
    actor: User,
    user_id: UUID,
    email: str,
    db_session: AsyncSession,
) -> None:
    """Record ``user_deleted`` with the acting administrator as the actor.

    Called only after the user row is gone. The target id is in the details,
    for the same reason as :func:`disable_user`.
    """
    await log_security_event(
        background_tasks=BackgroundTasks(),
        event_type="user_deleted",
        user_id=actor.id,
        details={"email": email, "subject_user_id": str(user_id), "actor_id": str(actor.id)},
        db_session=db_session,
    )
