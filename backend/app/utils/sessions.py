"""The whole life of a Session: open, refresh, accept, end (#279).

A session is one refresh token and the access tokens derived from it, or, for
the OAuth2 form login, one access token on its own (ADR 0011 decision 2).
Following one used to mean reading token minting in ``core/security.py``, the
allowlist helpers, the cookie helper, three lifetime settings, the
authentication dependency and six handlers, with tokens minted at five sites
by four recipes. This module now owns it:

- :func:`open` issues a session with a refresh token (login, and the fresh
  session after change-password). It is the one issuer of refresh tokens, so
  every route issues the same lifetime and cookie max-age.
- :func:`open_access_only` issues an access-only session (the OAuth2 form).
- :func:`refresh` derives a new access token from a refresh token.
- :func:`accepts` is the per-request check behind ``deps.get_current_user``.
- :func:`end` ends the calling session; :func:`end_all` ends every session.

Refusals raise :class:`SessionRejected` with a reason, after the module has
recorded the security event. Handlers map the reason to their HTTP answer. A
refresh presented from another origin network has the same reason as a
refresh token that is not allowlisted, so no handler can answer differently.

Plain async functions, no HTTP. Storage is ``app.utils.allowlist``, which only
this module imports.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import async_object_session
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core import security
from app.core.config import settings
from app.core.security import map_jwt_http_error_to_event
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils import allowlist
from app.utils.background_tasks import log_security_event

logger = logging.getLogger("fastapi_rbac")


class RejectReason(str, Enum):
    # Not allowlisted, or (at refresh) presented from another origin network.
    NOT_ACCEPTED = "not_accepted"
    MISSING_SUBJECT = "missing_subject"
    INVALID_SUBJECT = "invalid_subject"
    # At refresh: the token's user row is gone. Opening a session also uses
    # this when the user is inactive (#281). An inactive user's existing
    # sessions are refused by the allowlist, because disable ends them.
    USER_UNAVAILABLE = "user_unavailable"
    # At end: nothing presented identifies which session the caller holds.
    UNIDENTIFIED = "unidentified"


class SessionRejected(Exception):
    """The module refused a token. The security event, if any, is already recorded."""

    def __init__(self, reason: RejectReason) -> None:
        super().__init__(reason.value)
        self.reason = reason


class SessionError(Exception):
    """An unexpected failure inside :func:`refresh`, with the token subject if it was read.

    Raised from the original exception. The caller records it under its own
    event name and answers 500.
    """

    def __init__(self, cause: Exception, *, subject: Optional[str]) -> None:
        super().__init__(str(cause))
        self.cause = cause
        self.subject = subject


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    refresh_token: str
    # Seconds; the refresh cookie's Max-Age, equal to the refresh token's lifetime.
    refresh_max_age: int


@dataclass(frozen=True)
class RefreshedSession:
    """What a refresh hands back.

    A dataclass rather than a bare token so a rotated refresh token and its
    cookie max-age (#280) can be added without changing callers.
    """

    access_token: str
    user: User


def _access_minutes() -> int:
    return settings.ACCESS_TOKEN_EXPIRE_MINUTES


def _refresh_minutes() -> int:
    return settings.REFRESH_TOKEN_EXPIRE_MINUTES


def _mint_access_token(user: User) -> str:
    return security.create_access_token(
        user.id, user.email, expires_delta=timedelta(minutes=_access_minutes())
    )


async def is_active_now(user: User) -> bool:
    """Whether ``user`` is active, re-read from the database when the row is loaded.

    Login holds the user object it read before ``disable_user`` commits. A
    check of that object would still see the old flag. Reloading sees the
    commit. A user that is not attached (a test double, or a row already
    detached) keeps the flag it was given.
    """
    try:
        bind = async_object_session(user)
    except Exception:
        bind = None
    if bind is not None:
        try:
            await bind.refresh(user)
        except Exception:
            logger.exception("Could not reload user %s before opening a session", getattr(user, "id", None))
    return bool(user.is_active)


async def _open_inactive(user: User, redis_client: Redis) -> None:
    """Drop anything just written for an inactive user, then refuse the open."""
    await end_all(user.id, redis_client=redis_client)
    raise SessionRejected(RejectReason.USER_UNAVAILABLE)


async def open(user: User, client_address: Optional[str], *, redis_client: Redis) -> IssuedSession:
    """Open a session with a refresh token, recording ``client_address`` as its origin.

    At ``CONCURRENT_SESSION_LIMIT`` the oldest other session is evicted.
    An inactive user gets no session: the flag is read again around the
    allowlist write, so a disable that commits in between does not leave one.
    """
    if not await is_active_now(user):
        raise SessionRejected(RejectReason.USER_UNAVAILABLE)
    refresh_minutes = _refresh_minutes()
    access_token = _mint_access_token(user)
    refresh_token = security.create_refresh_token(user.id, expires_delta=timedelta(minutes=refresh_minutes))
    await allowlist.record_session(
        redis_client,
        user.id,
        access_token=access_token,
        access_expire_minutes=_access_minutes(),
        refresh_token=refresh_token,
        refresh_expire_minutes=refresh_minutes,
        origin_ip=client_address,
    )
    if not await is_active_now(user):
        await _open_inactive(user, redis_client)
    return IssuedSession(access_token, refresh_token, refresh_max_age=refresh_minutes * 60)


async def open_access_only(user: User, client_address: Optional[str], *, redis_client: Redis) -> str:
    """Open an access-only session and return its access token.

    The OAuth2 password form behind Swagger's Authorize button issues no
    refresh cookie, so the access token is the whole session: it counts toward
    ``CONCURRENT_SESSION_LIMIT``, records its origin network like any session,
    and ends when the token expires. It is never refreshed, so its origin is
    never compared.

    Its route has no CSRF dependency: Swagger's Authorize form cannot send the
    header. That is deliberate until the owner decides otherwise (#279).
    An inactive user gets no session, same as :func:`open`.
    """
    if not await is_active_now(user):
        raise SessionRejected(RejectReason.USER_UNAVAILABLE)
    access_token = _mint_access_token(user)
    await allowlist.record_session(
        redis_client,
        user.id,
        access_token=access_token,
        access_expire_minutes=_access_minutes(),
        origin_ip=client_address,
    )
    if not await is_active_now(user):
        await _open_inactive(user, redis_client)
    return access_token


async def _record(
    db_session: AsyncSession, event_type: str, details: dict, user_id: Optional[UUID] = None
) -> None:
    await log_security_event(
        background_tasks=BackgroundTasks(),
        db_session=db_session,
        event_type=event_type,
        user_id=user_id,
        details=details,
    )


async def refresh(
    refresh_token: str,
    client_address: Optional[str],
    *,
    db_session: AsyncSession,
    redis_client: Redis,
) -> RefreshedSession:
    """Derive a new access token for the session of ``refresh_token``.

    In order: the allowlist; the origin network, where a mismatch ends this
    session only (ADR 0011 decision 5); then the user row must still exist.
    An inactive user is not a second check: disable ends their sessions, and
    the allowlist is the only revocation mechanism (ADR 0011 decision 1,
    #281). After the derived access token is written, the refresh token is
    checked again. A disable that finished in between leaves that token
    dead, so the derived access token is revoked and the refresh is refused.
    A JWT decode failure is recorded and its ``HTTPException`` from
    ``decode_token`` propagates.
    """
    ip_address = client_address or "Unknown"
    try:
        payload = security.decode_token(refresh_token, token_type="refresh")
    except HTTPException as exc:
        await _record(
            db_session,
            map_jwt_http_error_to_event(exc, flow="refresh"),
            {
                "token_error": (exc.detail if isinstance(exc.detail, str) else str(exc.detail)),
                "ip_address": ip_address,
            },
        )
        raise
    subject: Optional[str] = None
    try:
        subject = payload["sub"]
        if not await allowlist.is_live(redis_client, subject, TokenType.REFRESH, refresh_token):
            await _record(db_session, "refresh_token_invalid", {"user_id": subject, "ip_address": ip_address})
            raise SessionRejected(RejectReason.NOT_ACCEPTED)
        if await allowlist.refresh_origin_is_anomalous(redis_client, subject, refresh_token, client_address):
            await allowlist.revoke_session(redis_client, subject, refresh_token)
            # Logged inline as well as persisted. The HTTP answer is the
            # ordinary refresh failure, so this line is how the anomaly rate
            # is counted in logs -- and ADR 0011 decision 5 defers notifying
            # users precisely until that rate is known.
            logger.warning(
                "refresh_origin_network_mismatch: revoked session for token subject "
                f"{subject} presented from {ip_address}"
            )
            await _record(
                db_session, "refresh_origin_network_mismatch", {"user_id": subject, "ip_address": ip_address}
            )
            raise SessionRejected(RejectReason.NOT_ACCEPTED)
        try:
            user = await crud.user.get(id=UUID(subject), db_session=db_session)
        except ValueError:
            await _record(
                db_session, "refresh_token_invalid_uuid", {"user_id": subject, "ip_address": ip_address}
            )
            raise SessionRejected(RejectReason.INVALID_SUBJECT)
        if user is None:
            assert subject is not None
            await _record(
                db_session,
                "refresh_token_user_not_found_or_inactive",
                {"email": "N/A", "token_subject": subject, "ip_address": ip_address},
                user_id=UUID(subject),
            )
            raise SessionRejected(RejectReason.USER_UNAVAILABLE)
        access_token = _mint_access_token(user)
        await allowlist.add_derived_access_token(
            redis_client, user.id, access_token, refresh_token, _access_minutes()
        )
        # Disable can finish both endings after the first is_live check and
        # before this write. The new access token would otherwise stay usable.
        if not await allowlist.is_live(redis_client, user.id, TokenType.REFRESH, refresh_token):
            await allowlist.revoke_session(redis_client, user.id, refresh_token)
            await _record(db_session, "refresh_token_invalid", {"user_id": subject, "ip_address": ip_address})
            raise SessionRejected(RejectReason.NOT_ACCEPTED)
        return RefreshedSession(access_token=access_token, user=user)
    except SessionRejected:
        raise
    except Exception as e:
        raise SessionError(e, subject=subject) from e


async def accepts(access_token: str, *, redis_client: Redis) -> UUID:
    """Return the user id of a live access token, or raise :class:`SessionRejected`.

    Never compares the origin network: that happens at refresh only (ADR 0011
    decision 5). A JWT decode failure propagates from ``decode_token``.
    """
    payload = security.decode_token(access_token)
    subject = payload.get("sub")
    if not subject:
        raise SessionRejected(RejectReason.MISSING_SUBJECT)
    try:
        user_id = UUID(subject)
    except ValueError:
        raise SessionRejected(RejectReason.INVALID_SUBJECT)
    if not await allowlist.is_live(redis_client, subject, TokenType.ACCESS, access_token):
        raise SessionRejected(RejectReason.NOT_ACCEPTED)
    return user_id


async def end(
    user_id: UUID,
    *,
    refresh_token: Optional[str],
    access_token: Optional[str],
    redis_client: Redis,
) -> None:
    """End the calling session only (ADR 0011 decision 9).

    The session is the refresh token's when one is presented, otherwise the
    access token's. Raises ``SessionRejected(UNIDENTIFIED)``, ending nothing,
    when neither identifies a session.
    """
    ended = await allowlist.end_caller_session(
        redis_client, user_id, refresh_token=refresh_token, access_token=access_token
    )
    if not ended:
        raise SessionRejected(RejectReason.UNIDENTIFIED)


async def end_all(user_id: UUID, *, redis_client: Redis) -> None:
    """End every session the user holds, and nothing else.

    A pending reset link is not a session; callers that must end one call
    ``emailed_links.revoke`` beside this. Awaited inline, never queued (#206).
    """
    await allowlist.revoke_all_user_tokens(redis_client, user_id)
