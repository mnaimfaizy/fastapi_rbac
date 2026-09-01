"""Single owner of "does this password meet the policy" for every path that sets one (#192).

``PasswordValidator.validate_complexity`` returns ``(is_valid, errors)``. Three
of its four callers unpacked that tuple; registration tested the tuple itself
for falsiness. A 2-tuple is always truthy, so ``not validate_complexity(...)``
was never true and registration's complexity gate never ran for any input --
the 8-character common password ``password`` was accepted at sign-up and then
refused by every reset and change path afterwards.

The fix is not to unpack the tuple at that one call site, because the next
password-setting path added would be free to get it wrong again. Every path
now calls :func:`enforce_password_complexity`, which validates and raises. The
tuple is unpacked exactly once, here, and a call site has no return value it
can misread: it either continues or it does not.

The policy itself is unchanged and still lives entirely in settings
(``PASSWORD_MIN_LENGTH``, ``PASSWORD_REQUIRE_*``, ``PREVENT_*``). This module
owns when it is applied and what a failure looks like, not what it says.

A complexity failure is safe to report in full, including on registration,
where the response is otherwise uniform across every account state (#113,
#137). It describes the password the caller just submitted and is decidable
without looking an account up, so it distinguishes nothing about the address --
the same carve-out :mod:`app.utils.account_token_responses` documents.
"""

from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks, HTTPException, status

from app.core.security import PasswordValidator
from app.utils.background_tasks import log_security_event

# One wording for every path that sets a password. Registration used to say
# "Password ..." while the reset and change paths said "New password ...",
# which is the sort of drift that follows from each call site owning its own
# message. Admin create and admin update use this same wording (#198).
PASSWORD_COMPLEXITY_FAILURE_MESSAGE = "Password does not meet complexity requirements."


async def enforce_password_complexity(
    password: str,
    *,
    background_tasks: BackgroundTasks,
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
) -> None:
    """Reject ``password`` with 400 unless it satisfies the configured policy.

    Returns ``None`` when the password is acceptable. Callers must not test the
    return value -- there isn't one; that is the point.

    ``event_type`` names what the caller was doing so each path keeps its own
    audit event. The validator's error list is merged into ``details`` so the
    record says which rules failed.
    """
    is_valid, errors = PasswordValidator.validate_complexity(password)
    if is_valid:
        return

    # Awaited rather than queued as ``add_task(log_security_event, ...)``:
    # FastAPI attaches an endpoint's BackgroundTasks to the response it
    # returns, and an HTTPException becomes a fresh response carrying none of
    # them, so a task queued on a raising path never runs. Awaiting gets the
    # event to Celery in production, where ``log_security_event`` dispatches
    # immediately. Outside production it queues the write on the same doomed
    # BackgroundTasks and the record is still lost -- a gap shared with
    # app.utils.account_token_responses, not one introduced here.
    await log_security_event(
        background_tasks=background_tasks,
        event_type=event_type,
        user_id=user_id,
        details={**(details or {}), "errors": errors},
    )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"message": PASSWORD_COMPLEXITY_FAILURE_MESSAGE, "errors": errors},
    )
