"""Single owner of "this token-bearing request failed, and why is nobody's business" (#137).

Verify-email and the two password-reset confirm endpoints each answered
"Account is inactive. Cannot ..." for a disabled user. That confirmed an
account exists at the submitted address in one request -- the same oracle #113
closed for registration and resend-verification, narrowed to disabled users.
The neighbouring failure branches were no better: they answered "Invalid token
or user not found." in one place and "Invalid token" in another, so the set of
distinguishable outcomes grew every time someone added a branch.

Every failure in these flows now leaves through :func:`reject_verification` or
:func:`reject_password_reset`. Each takes the security event that says what
actually happened and returns the one message that says nothing. Putting the
policy behind a call is the point: a branch added later cannot accidentally
invent its own wording, because there is no wording at the call site to invent.

What is deliberately *not* uniform:

- JWT decode failures, which ``decode_token`` answers with 401 before any
  account is consulted. They describe the token the caller supplied and are
  decidable without a database.
- Password complexity and history failures, which describe the submitted
  password. Complexity is checked before any lookup; history is reachable only
  by a caller already holding a valid, allow-listed token -- that is, the
  mailbox owner, to whom the account's existence is not a secret.
"""

from typing import NoReturn, Optional
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.utils.background_tasks import log_security_event

# The one answer verify-email gives to every failure that requires looking an
# account up: unknown address, disabled account, wrong token, expired token,
# or an unused token whose Redis key is gone. A repeat visit with a still-valid
# JWT for an active already-verified user is a 200 instead (#239); disabled
# accounts stay on this message so that success is not an oracle (#137).
# It must stay true of all of those failures without indicating which
# occurred, and it must point the caller at the one action that can help.
INVALID_VERIFICATION_TOKEN_MESSAGE = (
    "This verification link is invalid or has expired. "
    "Please request a new verification email and try again."
)

# The same, for both password-reset confirm endpoints.
INVALID_PASSWORD_RESET_TOKEN_MESSAGE = (
    "This password reset link is invalid or has expired. "
    "Please request a new password reset and try again."
)

# The one answer /password-reset/request gives for every address. The condition
# is stated in the message precisely so the message can be returned when the
# condition does not hold. The success branch used to drop the closing full
# stop the other two branches carried, which distinguished an active account
# from every other state on a single request.
PASSWORD_RESET_REQUEST_UNIFORM_MESSAGE = (
    "If the email exists and the account is active, a password reset link has been sent."
)


async def _reject(
    *,
    background_tasks: BackgroundTasks,
    event_type: str,
    message: str,
    user_id: Optional[UUID],
    details: dict,
    db_session: Optional[AsyncSession] = None,
) -> NoReturn:
    # Awaited, not queued on ``background_tasks``. FastAPI attaches an
    # endpoint's BackgroundTasks to the response it returns; an HTTPException
    # is turned into a fresh response by the exception handler, which carries
    # no tasks. ``log_security_event`` writes the AuditLog row in-process (#243).
    await log_security_event(
        background_tasks=background_tasks,
        event_type=event_type,
        user_id=user_id,
        details=details,
        db_session=db_session,
    )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


async def reject_verification(
    *,
    background_tasks: BackgroundTasks,
    event_type: str,
    details: dict,
    user_id: Optional[UUID] = None,
    db_session: Optional[AsyncSession] = None,
) -> NoReturn:
    """Record why verification failed, then answer as if nothing was learned."""
    await _reject(
        background_tasks=background_tasks,
        event_type=event_type,
        message=INVALID_VERIFICATION_TOKEN_MESSAGE,
        user_id=user_id,
        details=details,
        db_session=db_session,
    )


async def reject_password_reset(
    *,
    background_tasks: BackgroundTasks,
    event_type: str,
    details: dict,
    user_id: Optional[UUID] = None,
    db_session: Optional[AsyncSession] = None,
) -> NoReturn:
    """Record why the reset failed, then answer as if nothing was learned."""
    await _reject(
        background_tasks=background_tasks,
        event_type=event_type,
        message=INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
        user_id=user_id,
        details=details,
        db_session=db_session,
    )
