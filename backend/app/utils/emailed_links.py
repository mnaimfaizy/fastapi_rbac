"""The whole life of an Emailed link: issue, redeem, revoke (#283).

An emailed link is a single-use JWT mailed to an address to prove the reader
holds that mailbox: a verification link or a password-reset link. Redeeming
one used to be written out three times in the auth endpoints (verify-email and
both reset-confirm routes), with uniform token-flow rejection (ADR 0010) kept
true by hand-ordering the same branches in each. The two kinds were also stored
two ways: verification as one raw value under its own key, reset links as
members of the session allowlist, consumed only by revoking every token the
user held.

This module now owns both kinds:

- :func:`issue` stores only the sha256 of a fresh link, one per kind and user,
  so issuing replaces any live link of that kind (latest wins).
- :func:`verify_email` and :func:`redeem_password_reset` share one private
  pipeline: decode, subject, user lookup, stored-hash check, ``is_active``.
  Every failure that needed an account looked up leaves through one uniform
  refusal per kind and records which failure it was as a security event.
- :func:`revoke` discards a live link, for the unverified-user sweep, the
  password module and ``POST /logout/all``.

What stays distinct, as ADR 0010 decision 6 records: a JWT decode failure
answers before any account is consulted (401 from ``decode_token``), and a
password refused by ``act`` describes the submitted password, reachable only
by the holder of a live reset link.

Security event details carry ``token_used`` as a 12-hex-character fingerprint
of the submitted token, never the token itself (#282).
"""

import hashlib
import hmac
from dataclasses import dataclass, field
from enum import Enum
from typing import Awaitable, Callable, Literal, NoReturn, Optional, Union
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core import security
from app.core.config import settings
from app.core.security import map_jwt_http_error_to_event
from app.models.user_model import User
from app.utils.account_token_responses import (
    INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
    INVALID_VERIFICATION_TOKEN_MESSAGE,
)
from app.utils.background_tasks import log_security_event
from app.utils.response_timing import response_time_floor


class LinkKind(str, Enum):
    VERIFICATION = "verification"
    PASSWORD_RESET = "password_reset"


@dataclass(frozen=True)
class VerifiedNow:
    user: User


@dataclass(frozen=True)
class AlreadyVerified:
    """A repeat visit with a valid link for an active, verified user (#239)."""

    user: User


class LinkRedemptionError(Exception):
    """An unexpected failure inside a redemption, with what was known when it happened.

    Raised from the original exception. The caller records it under its own
    event name and answers 500; nothing here reaches a response body.
    """

    def __init__(
        self,
        cause: Exception,
        *,
        subject: Optional[str],
        user_id: Optional[UUID],
        email: Optional[str],
    ) -> None:
        super().__init__(str(cause))
        self.cause = cause
        self.subject = subject
        self.user_id = user_id
        self.email = email


@dataclass(frozen=True)
class _Policy:
    jwt_type: Literal["verification", "reset"]
    lifetime_setting: str
    refusal: str
    missing_sub_event: str
    user_not_found_event: str
    not_stored_event: str
    inactive_event: str


_POLICIES = {
    LinkKind.VERIFICATION: _Policy(
        jwt_type="verification",
        lifetime_setting="VERIFICATION_TOKEN_EXPIRE_MINUTES",
        refusal=INVALID_VERIFICATION_TOKEN_MESSAGE,
        missing_sub_event="verify_email_token_missing_sub",
        user_not_found_event="verify_email_user_not_found",
        not_stored_event="verify_email_token_mismatch_or_expired_redis",
        inactive_event="verify_email_inactive_account",
    ),
    LinkKind.PASSWORD_RESET: _Policy(
        jwt_type="reset",
        lifetime_setting="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES",
        refusal=INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
        missing_sub_event="password_reset_token_missing_sub",
        user_not_found_event="password_reset_user_not_found",
        not_stored_event="password_reset_token_not_in_redis",
        inactive_event="password_reset_inactive_account",
    ),
}


def _key(kind: LinkKind, user_id: Union[UUID, str]) -> str:
    return f"emailed_link:{kind.value}:{user_id}"


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _fingerprint(token: str) -> str:
    # Enough to correlate events about one link; useless for redeeming it.
    return _digest(token)[:12]


def _mint(kind: LinkKind, user: User) -> str:
    if kind is LinkKind.VERIFICATION:
        return security.create_verification_token(user.email)
    return security.create_reset_token(user.email)


async def issue(kind: LinkKind, user: User, *, redis: Redis) -> str:
    """Mint a link of ``kind`` for ``user`` and make it the only live one.

    Only the token's sha256 is stored. Returns the token for the caller to
    mail; sending it is the caller's job.
    """
    token = _mint(kind, user)
    lifetime_minutes = getattr(settings, _POLICIES[kind].lifetime_setting)
    await redis.setex(_key(kind, user.id), lifetime_minutes * 60, _digest(token))
    return token


async def revoke(kind: LinkKind, user_id: Union[UUID, str], *, redis: Redis) -> None:
    """Discard the live link of ``kind`` for the user, if there is one."""
    await redis.delete(_key(kind, user_id))


async def _stored_digest(kind: LinkKind, user_id: UUID, redis: Redis) -> Optional[str]:
    stored = await redis.get(_key(kind, user_id))
    if stored is None:
        return None
    return stored.decode("utf-8") if isinstance(stored, bytes) else str(stored)


def _matches(stored: Optional[str], token: str) -> bool:
    return stored is not None and hmac.compare_digest(stored, _digest(token))


async def _consume(kind: LinkKind, user_id: UUID, token: str, redis: Redis) -> None:
    # Only the link just redeemed: one issued in the meantime stays live.
    if _matches(await _stored_digest(kind, user_id, redis), token):
        await revoke(kind, user_id, redis=redis)


@dataclass
class _Attempt:
    kind: LinkKind
    token: str
    client_address: Optional[str]
    db_session: AsyncSession
    redis: Redis
    subject: Optional[str] = None
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    policy: _Policy = field(init=False)

    def __post_init__(self) -> None:
        self.policy = _POLICIES[self.kind]

    async def record(self, event_type: str, details: Optional[dict] = None) -> None:
        await log_security_event(
            background_tasks=BackgroundTasks(),
            db_session=self.db_session,
            event_type=event_type,
            user_id=self.user_id,
            details={
                **(details or {}),
                "token_used": _fingerprint(self.token),
                "ip_address": self.client_address,
            },
        )

    async def reject(self, event_type: str, details: Optional[dict] = None) -> NoReturn:
        """Record why the link was refused, then answer as if nothing was learned.

        The event is awaited, not queued: an HTTPException becomes a fresh
        response that carries none of the endpoint's background tasks.
        """
        await self.record(event_type, details)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=self.policy.refusal)

    def failed(self, cause: Exception) -> LinkRedemptionError:
        return LinkRedemptionError(cause, subject=self.subject, user_id=self.user_id, email=self.email)


async def _validated_user(attempt: _Attempt, *, accept_consumed: Callable[[User], bool]) -> User:
    """The one ordering every redemption goes through (ADR 0010).

    ``is_active`` is checked after the stored link, so a disabled account is
    reachable only by a caller who already holds its live link. A link that is
    no longer stored is accepted only where ``accept_consumed`` says so.
    """
    policy = attempt.policy
    try:
        payload = security.decode_token(attempt.token, token_type=policy.jwt_type)
    except HTTPException as exc:
        if attempt.kind is LinkKind.VERIFICATION:
            await attempt.record(
                map_jwt_http_error_to_event(exc, flow="verify_email"),
                {"error": exc.detail if isinstance(exc.detail, str) else str(exc.detail)},
            )
        raise
    subject = payload.get("sub")
    if not subject:
        await attempt.reject(policy.missing_sub_event)
    attempt.subject = str(subject)

    user = await crud.user.get_by_email(db_session=attempt.db_session, email=attempt.subject)
    if not user:
        await attempt.reject(policy.user_not_found_event, {"email_from_token": attempt.subject})
    attempt.user_id, attempt.email = user.id, user.email

    stored = await _stored_digest(attempt.kind, user.id, attempt.redis)
    if not _matches(stored, attempt.token) and not accept_consumed(user):
        if attempt.kind is LinkKind.PASSWORD_RESET:
            await attempt.reject(policy.not_stored_event, {"token_in_redis": stored is not None})
        await attempt.reject(policy.not_stored_event, {"email": user.email})
    if not user.is_active:
        await attempt.reject(policy.inactive_event, {"email": user.email})
    return user


async def verify_email(
    token: str,
    *,
    client_address: Optional[str],
    db_session: AsyncSession,
    redis: Redis,
) -> Union[VerifiedNow, AlreadyVerified]:
    """Redeem a verification link, or raise the uniform 400.

    A correctly signed, unexpired link for an active, already-verified user is
    :class:`AlreadyVerified` even after the stored link was consumed (#239).
    ``is_active`` is evaluated first, so a disabled account, verified or not,
    still gets the uniform refusal.
    """
    attempt = _Attempt(LinkKind.VERIFICATION, token, client_address, db_session, redis)
    async with response_time_floor():
        try:
            user = await _validated_user(attempt, accept_consumed=lambda u: bool(u.is_active and u.verified))
            if user.verified:
                await attempt.record("verify_email_already_verified", {"email": user.email})
                return AlreadyVerified(user)
            updated = await crud.user.update(
                db_session=db_session, obj_current=user, obj_new={"verified": True, "verification_code": None}
            )
            if not updated:
                await attempt.record("verify_email_update_failed", {"email": user.email})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user verification status.",
                )
            await _consume(LinkKind.VERIFICATION, updated.id, token, redis)
            await attempt.record("email_verified_successfully", {"email": updated.email})
            return VerifiedNow(updated)
        except HTTPException:
            raise
        except Exception as e:
            raise attempt.failed(e) from e


async def redeem_password_reset(
    token: str,
    act: Callable[[User], Awaitable[object]],
    *,
    client_address: Optional[str],
    db_session: AsyncSession,
    redis: Redis,
) -> None:
    """Validate a reset link, run ``act(user)``, then consume the link.

    The link is consumed only if ``act`` returns, so a refused password leaves
    it usable. Whatever ``act`` raises propagates unchanged; the floor covers
    it too, so the action's duration does not tell a valid link from an
    invalid one.
    """
    attempt = _Attempt(LinkKind.PASSWORD_RESET, token, client_address, db_session, redis)
    async with response_time_floor():
        try:
            user = await _validated_user(attempt, accept_consumed=lambda _u: False)
        except HTTPException:
            raise
        except Exception as e:
            raise attempt.failed(e) from e
        user_id = user.id
        await act(user)
        try:
            await _consume(LinkKind.PASSWORD_RESET, user_id, token, redis)
        except Exception as e:
            raise attempt.failed(e) from e
