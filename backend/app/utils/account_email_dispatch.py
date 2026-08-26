"""Single owner of "given an email address, dispatch the right mail and reveal nothing" (#113).

Registration and resend-verification both need to answer the same question —
what does this address correspond to, and what mail should that produce — while
returning a response that does not distinguish the cases. Previously each
endpoint implemented that policy separately and they drifted apart:
resend-verification returned "This email is already verified." for established
users and "Account is inactive." for disabled ones, confirming existence in a
single request, which made registration's deliberately vague 400 pointless.

Both endpoints are now thin callers of :func:`dispatch_account_email`. They
differ only in ``may_create``. Keeping the policy in one place is the point: the
defect being fixed is precisely that it lived in two.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, cast

from fastapi import BackgroundTasks, HTTPException, status
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core import security
from app.core.config import settings
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, UserRegister
from app.utils.background_tasks import (
    log_security_event,
    send_registration_notice_email,
    send_verification_email,
)

logger = logging.getLogger(__name__)

# The one message both endpoints return, for every account state. It must stay
# true of all four outcomes without indicating which occurred: an email was sent
# to the address if an account is involved, and the caller is told to follow the
# link inside. It must not assert that an account was created.
ACCOUNT_EMAIL_UNIFORM_MESSAGE = (
    "If this email address can be registered or verified, we have sent it a message. "
    "Please check your inbox, and your spam folder, and follow the link inside."
)


class AccountState(str, Enum):
    """What an email address currently corresponds to.

    ``DISABLED`` is checked before ``verified`` because an inactive account is
    inactive whether or not it ever verified.
    """

    ABSENT = "absent"
    PENDING = "pending"
    ESTABLISHED = "established"
    DISABLED = "disabled"


@dataclass
class DispatchResult:
    """Outcome of a dispatch, for the caller's logging and test-mode payload.

    Nothing here may reach an ordinary response body. ``verification_token`` is
    exposed only under ``MODE == "testing"`` so integration tests can drive the
    verification flow without reading mail.
    """

    state: AccountState
    verification_token: Optional[str] = None
    user_id: Optional[object] = None


def classify(user: Optional[User]) -> AccountState:
    """Map a user row (or its absence) onto the four states."""
    if user is None:
        return AccountState.ABSENT
    if not user.is_active:
        return AccountState.DISABLED
    if user.verified:
        return AccountState.ESTABLISHED
    return AccountState.PENDING


def account_email_budget_key(email: str) -> str:
    """Redis key for the shared per-address mail budget."""
    return f"account_email_budget:{email.lower()}"


async def consume_account_email_budget(
    *,
    email: str,
    redis_client: Redis,
    background_tasks: BackgroundTasks,
    ip_address: str,
) -> None:
    """Charge one unit of the per-address mail budget, or raise 429.

    Charged on every attempt, not only when mail is dispatched. If it were
    charged only on dispatch, the presence or absence of a 429 after three
    attempts would itself distinguish an address that produces mail from one
    that does not — reintroducing the oracle through the rate limiter.

    Registration's IP-scoped counter is deliberately separate: it tracks the
    requester rather than the target and so leaks nothing about the address.

    Deliberately not bypassed under ``MODE == "testing"``. The IP-scoped
    registration counter is bypassed there because a whole suite shares one
    client address, but this budget is per address and the Redis mock is
    function-scoped, so it resets between tests -- and bypassing it would make
    the "shared across both endpoints" property untestable, which is the
    property most worth a test.
    """
    key = account_email_budget_key(email)
    used_raw = await redis_client.get(key)
    used = int(used_raw) if used_raw else 0

    if used >= settings.MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR:
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="account_email_budget_exhausted",
            details={"email": email, "ip_address": ip_address},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests for this email address. Please try again later.",
        )

    await redis_client.incr(key)
    await redis_client.expire(key, settings.ACCOUNT_EMAIL_RATE_LIMIT_PERIOD_SECONDS)


async def _issue_verification(
    *,
    user: User,
    redis_client: Redis,
    background_tasks: BackgroundTasks,
    token: Optional[str] = None,
) -> str:
    """Store a verification token in Redis and send the verification mail.

    Reissuing replaces the previous token, so an older link stops working and
    lands on the verify-email page, which already offers resend.

    Redis is the source of truth for verification: ``/verify-email`` compares
    the submitted token against ``verification_token:{user.id}`` and never reads
    ``User.verification_code``. The column is written at creation and cleared on
    verify, so it is left alone on reissue — matching the behaviour resend
    already had, rather than adding a write nothing reads.
    """
    issued = token or security.create_verification_token(user.email)
    await redis_client.setex(
        f"verification_token:{user.id}",
        settings.VERIFICATION_TOKEN_EXPIRE_MINUTES * 60,
        issued,
    )
    await send_verification_email(
        background_tasks=background_tasks,
        user_email=user.email,
        verification_token=issued,
        verification_url=settings.EMAIL_VERIFICATION_URL,
    )
    return issued


async def _create_pending_user(
    *,
    registration: UserRegister,
    db_session: AsyncSession,
    verification_code: str,
) -> User:
    """Create an unverified user and assign the default role."""
    user_create = IUserCreate(
        **registration.model_dump(),
        verified=False,
        verification_code=verification_code,
        roles=[],
        last_changed_password_date=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    new_user = await crud.user.create(db_session=db_session, obj_in=user_create)

    if not new_user or not getattr(new_user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred. Please try again later.",
        )

    default_role = await crud.role.get_role_by_name(name="User", db_session=db_session)
    if default_role:
        await crud.user.add_roles_by_ids(
            user_id=new_user.id,
            role_ids=[default_role.id],
            db_session=db_session,
        )
        await db_session.refresh(new_user, attribute_names=["roles"])

    return new_user


async def dispatch_account_email(
    *,
    email: str,
    db_session: AsyncSession,
    redis_client: Redis,
    background_tasks: BackgroundTasks,
    ip_address: str,
    may_create: bool,
    registration: Optional[UserRegister] = None,
) -> DispatchResult:
    """Dispatch the one email an address's state calls for, revealing nothing.

    +--------------+------------------------------+---------------------------+
    | State        | may_create=True (register)   | may_create=False (resend) |
    +==============+==============================+===========================+
    | Absent       | create user, send verify     | send nothing              |
    | Pending      | send verify, mutate nothing  | send verify               |
    | Established  | send notice                  | send notice               |
    | Disabled     | send notice                  | send notice               |
    +--------------+------------------------------+---------------------------+

    The caller is responsible for returning an identical response regardless of
    the :class:`AccountState` in the result, and for wrapping the call in
    :func:`app.utils.response_timing.response_time_floor`.

    Raises:
        HTTPException: 429 when the address's mail budget is exhausted. This is
            the only status this function distinguishes, and it is a function of
            request volume, not of account state.
    """
    await consume_account_email_budget(
        email=email,
        redis_client=redis_client,
        background_tasks=background_tasks,
        ip_address=ip_address,
    )

    user = await crud.user.get_by_email(db_session=db_session, email=email)
    state = classify(user)

    if state is AccountState.ABSENT:
        if not may_create:
            # Deliberately sends nothing. Mailing an address with no account
            # would turn this endpoint into an open mailer for unsolicited
            # signup mail; the response-time floor covers this branch instead.
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="account_email_absent_no_mail_sent",
                details={"email": email, "ip_address": ip_address},
            )
            return DispatchResult(state=state)

        if registration is None:
            raise ValueError("registration payload is required when may_create is True")

        token = security.create_verification_token(email)
        new_user = await _create_pending_user(
            registration=registration,
            db_session=db_session,
            verification_code=token,
        )
        await _issue_verification(
            user=new_user,
            redis_client=redis_client,
            background_tasks=background_tasks,
            token=token,
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="user_registered",
            user_id=new_user.id,
            details={"email": email, "ip_address": ip_address},
        )
        return DispatchResult(state=state, verification_token=token, user_id=new_user.id)

    user = cast(User, user)

    if state is AccountState.PENDING:
        # Never mutate an existing pending user here. Overwriting credentials
        # would let an attacker re-register against a victim's unverified
        # address and have the victim activate an attacker-controlled account
        # by clicking the link in their own inbox.
        token = await _issue_verification(
            user=user,
            redis_client=redis_client,
            background_tasks=background_tasks,
        )
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="account_email_verification_reissued",
            user_id=user.id,
            details={"email": email, "ip_address": ip_address},
        )
        return DispatchResult(state=state, verification_token=token, user_id=user.id)

    # ESTABLISHED and DISABLED both receive the notice email. They are logged
    # apart so the uniform response stays debuggable in operations.
    await send_registration_notice_email(
        background_tasks=background_tasks,
        user_email=user.email,
    )
    background_tasks.add_task(
        log_security_event,
        background_tasks=background_tasks,
        event_type=(
            "account_email_notice_sent_established"
            if state is AccountState.ESTABLISHED
            else "account_email_notice_sent_disabled"
        ),
        user_id=user.id,
        details={"email": email, "ip_address": ip_address},
    )
    return DispatchResult(state=state, user_id=user.id)
