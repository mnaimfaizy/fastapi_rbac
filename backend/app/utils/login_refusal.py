"""Single owner of the one answer a failed password login gets (ADR 0015).

``POST /auth/login`` and ``POST /auth/access-token`` used to word each failure
for the state they found: a plain message for an unknown address, a lockout
countdown for an existing account, the minutes left for a locked one, and a
different status for a locked account on the form route. Every one of those is
something a caller without the password should not learn.

Every failure a caller can cause without the right password now raises
:func:`refuse_login`: unknown address, wrong password in any account state, an
account with no password set, and any attempt on a locked account. The audit
event, not the response, records which one it was.

What is deliberately *not* uniform, because only the password holder reaches it:

- ``Email is not verified.`` (422) and ``Inactive user`` (403), checked after
  the password is confirmed.
- A locked account is *not* in this list. With the right password it still
  gets the uniform refusal, so the lock really stops guessing: otherwise a
  locked account would keep confirming correct guesses.

Timing is the other half. A lookup that finds no usable hash would skip the
bcrypt check the other paths pay for, so :func:`spend_password_check` runs one
against a hash generated at import. The handlers also run inside
:func:`app.utils.response_timing.response_time_floor`.
"""

import secrets

from fastapi import HTTPException, status

from app.core.security import PasswordValidator

# 422 rather than 401: the SPA's interceptor treats any 401 as an expired
# session and tries a refresh, and the login form already shows a 422's
# ``detail.message``. The message states every condition it covers so that it
# can be returned for each of them.
LOGIN_REFUSED_STATUS = status.HTTP_422_UNPROCESSABLE_ENTITY
LOGIN_REFUSED_MESSAGE = (
    "Email or password is incorrect, or the account is temporarily locked. "
    "Try again later or reset your password."
)
LOGIN_REFUSED_DETAIL = {"field_name": "email", "message": LOGIN_REFUSED_MESSAGE}

# Generated per process from a random secret, at the configured work factor, so
# a check against it costs what a real one does and no hash sits in the source.
_DUMMY_PASSWORD_HASH = PasswordValidator.get_password_hash(secrets.token_urlsafe(32))


def refuse_login() -> HTTPException:
    """The uniform refusal. Raise it; never word a login failure at the call site."""
    return HTTPException(status_code=LOGIN_REFUSED_STATUS, detail=dict(LOGIN_REFUSED_DETAIL))


def spend_password_check(password: str) -> None:
    """Pay for one bcrypt check where there is no hash worth checking.

    Used for an unknown address, an account with no password, and a locked
    account. The result is discarded.
    """
    PasswordValidator.verify_password(password, _DUMMY_PASSWORD_HASH)
