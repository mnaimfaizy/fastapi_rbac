"""The one module through which a password is accepted for a user (#192, #271).

Setting a password is an ordered policy: complexity rules, reuse/history, end
every session, audit. Each of the six paths that set one used to re-assemble
that sequence by hand, and every fix to it had to be re-applied "to every path
that sets a password" (#192, #193, #196, #199, #233, #240). The admin path was
missed twice. Every path now calls one of two operations here instead:

- :func:`change_password` replaces the password of an existing user
  (self-service change, both reset-confirm endpoints, admin set).
- :func:`accept_initial_password` admits the first password of a user that
  does not exist yet (registration, admin create).

A refusal is raised as :class:`PasswordRefused` and answered by one exception
handler (``app.main``) as 400 with ``detail = {"message", "errors"}``, so the
three different spellings the reuse refusal used to have are gone.

What the rules say still lives entirely in settings (``PASSWORD_MIN_LENGTH``,
``PASSWORD_REQUIRE_*``, ``PREVENT_*``). This module owns when they are applied,
in what order, and what a refusal looks like.

A rules refusal is safe to report in full, including on registration, where the
response is otherwise uniform across every account state (#113, #137). It
describes the password the caller just submitted and is decidable without
looking an account up, so it distinguishes nothing about the address -- the
same carve-out :mod:`app.utils.account_token_responses` documents. The reset
flows call :func:`change_password` only after the token has been checked, so a
reuse refusal there is reachable only by the holder of a live reset link
(ADR 0010, decision 6).
"""

import logging
from enum import Enum
from typing import Any, NoReturn, Optional

from fastapi import BackgroundTasks
from redis.asyncio import Redis as AsyncRedis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.security import PasswordValidator
from app.crud.user_crud import PasswordReuseError
from app.models.user_model import User
from app.utils.background_tasks import log_security_event
from app.utils.token import revoke_all_user_tokens

logger = logging.getLogger(__name__)

# One wording for every path that sets a password. Registration used to say
# "Password ..." while the reset and change paths said "New password ...",
# which is the sort of drift that follows from each call site owning its own
# message. Admin create and admin update use this same wording (#198).
PASSWORD_COMPLEXITY_FAILURE_MESSAGE = "Password does not meet complexity requirements."


class PasswordChangeReason(Enum):
    """Why an existing user's password is being replaced."""

    SELF = "self"
    RESET = "reset"
    ADMIN = "admin"


class InitialPasswordReason(Enum):
    """Why a first password is being admitted for a user about to be created."""

    REGISTRATION = "registration"
    ADMIN_CREATE = "admin_create"


class PasswordRefusalKind(str, Enum):
    RULES = "rules"
    REUSE = "reuse"


class PasswordRefused(Exception):
    """The submitted password was refused by the policy.

    Deliberately not an ``HTTPException``: the module does not know it is being
    called from a route. ``app.main`` registers the one handler that turns it
    into a 400, so every path answers a refusal with the same body.
    """

    def __init__(self, kind: PasswordRefusalKind, message: str, errors: list[str]) -> None:
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.errors = errors

    @property
    def detail(self) -> dict[str, Any]:
        return {"message": self.message, "errors": self.errors}


# Audit event names keep the spelling each path used before this module
# existed, so existing log queries still match. Admin set had no success or
# reuse event at all; those two are new.
_RULES_REFUSED_EVENT = {
    PasswordChangeReason.SELF: "password_change_complexity_failed",
    PasswordChangeReason.RESET: "password_reset_complexity_failed",
    PasswordChangeReason.ADMIN: "admin_user_update_password_complexity_failed",
    InitialPasswordReason.REGISTRATION: "registration_password_complexity_failed",
    InitialPasswordReason.ADMIN_CREATE: "admin_user_create_password_complexity_failed",
}
_REUSE_REFUSED_EVENT = {
    PasswordChangeReason.SELF: "password_change_reused_password",
    PasswordChangeReason.RESET: "password_reset_history_violation",
    PasswordChangeReason.ADMIN: "admin_user_update_password_reused_password",
}
_SUCCEEDED_EVENT = {
    PasswordChangeReason.SELF: "password_change_successful",
    PasswordChangeReason.RESET: "password_reset_successful",
    PasswordChangeReason.ADMIN: "admin_user_update_password_successful",
}


def _audit_details(
    *, email: Optional[str], actor: Optional[User], client_address: Optional[str]
) -> dict[str, Any]:
    details: dict[str, Any] = {"email": email}
    if client_address is not None:
        details["ip_address"] = client_address
    if actor is not None:
        details["actor_id"] = str(actor.id)
    return details


async def _refuse(
    *,
    kind: PasswordRefusalKind,
    message: str,
    errors: list[str],
    event_type: str,
    user: Optional[User],
    details: dict[str, Any],
    db_session: AsyncSession,
) -> NoReturn:
    # Awaited rather than queued as a background task: FastAPI attaches an
    # endpoint's BackgroundTasks to the response it returns, and a raised
    # exception becomes a fresh response carrying none of them (#243).
    await log_security_event(
        background_tasks=BackgroundTasks(),
        event_type=event_type,
        user_id=user.id if user is not None else None,
        details={**details, "errors": errors},
        db_session=db_session,
    )
    raise PasswordRefused(kind, message, errors)


async def _check_rules(
    password: str,
    *,
    reason: PasswordChangeReason | InitialPasswordReason,
    user: Optional[User],
    details: dict[str, Any],
    db_session: AsyncSession,
) -> None:
    # The only caller of validate_complexity. It returns (is_valid, errors); a
    # call site that tested the tuple itself for falsiness is how registration
    # accepted every password for as long as it did (#192).
    is_valid, errors = PasswordValidator.validate_complexity(password)
    if is_valid:
        return
    await _refuse(
        kind=PasswordRefusalKind.RULES,
        message=PASSWORD_COMPLEXITY_FAILURE_MESSAGE,
        errors=errors,
        event_type=_RULES_REFUSED_EVENT[reason],
        user=user,
        details=details,
        db_session=db_session,
    )


def _apply_account_changes(user: User, reason: PasswordChangeReason) -> None:
    """The per-reason account state that goes with a new password.

    Every reason clears the lockout: the caller either knows the password
    (SELF), proved mailbox ownership (RESET) or is an administrator (ADMIN).
    An admin-set password is a temporary one, matching admin create.
    """
    user.is_locked = False
    user.locked_until = None
    user.number_of_failed_attempts = 0
    user.needs_to_change_password = reason is PasswordChangeReason.ADMIN


async def change_password(
    user: User,
    new_password: str,
    *,
    reason: PasswordChangeReason,
    actor: Optional[User],
    client_address: Optional[str],
    db_session: AsyncSession,
    redis_client: AsyncRedis,
) -> User:
    """Replace ``user``'s password, or raise :class:`PasswordRefused`.

    In order: rules, reuse, stage the hash, the history row and the per-reason
    account changes, end every session in the allowlist, commit, audit the
    success. Sessions end before the commit so a partial failure leaves the
    user logged out with the old password intact, never the reverse: a Redis
    failure rolls the staged password back.

    Out of scope, deliberately: the current-password check on SELF (it
    authenticates the caller) and issuing a fresh session afterwards. Both stay
    with the handler.
    """
    user_id = user.id
    details = _audit_details(email=user.email, actor=actor, client_address=client_address)

    await _check_rules(new_password, reason=reason, user=user, details=details, db_session=db_session)

    # The history row records where a self-service change or a reset came
    # from. An admin set records nothing: the address is the administrator's.
    created_by_ip = None if reason is PasswordChangeReason.ADMIN else client_address
    try:
        await crud.user.update_password(
            user=user,
            new_password=new_password,
            created_by_ip=created_by_ip,
            db_session=db_session,
        )
    except PasswordReuseError as e:
        await _refuse(
            kind=PasswordRefusalKind.REUSE,
            message=str(e),
            errors=[str(e)],
            event_type=_REUSE_REFUSED_EVENT[reason],
            user=user,
            details=details,
            db_session=db_session,
        )
    _apply_account_changes(user, reason)
    db_session.add(user)

    try:
        # Every token of every type, a pending reset link included: the
        # password has changed hands. Awaited inline, never queued (#206).
        await revoke_all_user_tokens(redis_client, user_id)
        await db_session.commit()
    except Exception:
        await _discard_staged_change(user, db_session)
        raise
    await db_session.refresh(user)

    await log_security_event(
        background_tasks=BackgroundTasks(),
        event_type=_SUCCEEDED_EVENT[reason],
        user_id=user_id,
        details=details,
        db_session=db_session,
    )
    return user


async def _discard_staged_change(user: User, db_session: AsyncSession) -> None:
    """Roll the staged password back and reload ``user`` from the database.

    Without the reload, the caller holds an expired instance whose next
    attribute access is a lazy load, which an async session cannot do.
    """
    await db_session.rollback()
    try:
        await db_session.refresh(user)
    except Exception:
        logger.exception("Failed to reload user after discarding a password change")


async def accept_initial_password(
    password: str,
    *,
    reason: InitialPasswordReason,
    email: str,
    actor: Optional[User],
    db_session: AsyncSession,
    client_address: Optional[str] = None,
) -> None:
    """Admit the first password of a user about to be created, or raise.

    Only the rules apply: there is no history to reuse from and no session to
    end. Called before anything is written, so a refusal leaves no user row,
    token or email behind.
    """
    details = _audit_details(email=email, actor=actor, client_address=client_address)
    await _check_rules(password, reason=reason, user=None, details=details, db_session=db_session)
