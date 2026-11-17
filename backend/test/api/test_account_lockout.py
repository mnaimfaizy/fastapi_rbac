"""Account lockout is applied once, from ACCOUNT_LOCKOUT_MINUTES (#275).

``crud.user.increment_failed_attempts`` sets the lock window when the
attempt that reaches ``MAX_LOGIN_ATTEMPTS`` fails. Nothing queued after the
request may shorten or lengthen it: the JSON login used to truncate the
window to whole hours (0 for anything under 60 minutes) and the form login
hard-coded 24 hours. The stored ``locked_until`` is read back from the
database after the request and its background tasks have finished.

The responses no longer say anything about the lock (ADR 0015): the locking
attempt and every attempt on a locked account get the uniform login refusal,
so the window is asserted only on the stored row.

In ``test/api/`` because they boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from datetime import datetime, timedelta, timezone
from test.utils import STRONG_TEST_PASSWORD, get_csrf_token
from typing import Any, Awaitable, Callable

import pytest
from httpx import AsyncClient, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.utils.login_refusal import LOGIN_REFUSED_DETAIL, LOGIN_REFUSED_STATUS

PASSWORD = STRONG_TEST_PASSWORD
WRONG_PASSWORD = PASSWORD[::-1]
LOCKOUT_MINUTES = 5
TOLERANCE = timedelta(seconds=30)

Attempt = Callable[[AsyncClient, str, str], Awaitable[Response]]


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def json_login(client: AsyncClient, email: str, password: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/login"), json={"email": email, "password": password}, headers=headers)


async def form_login(client: AsyncClient, email: str, password: str) -> Response:
    return await client.post(auth_url("/access-token"), data={"username": email, "password": password})


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


async def stored_user(db: AsyncSession, user_id: Any) -> User:
    db.expire_all()
    user = (await db.exec(select(User).where(User.id == user_id))).one()
    return user


async def events_for(db: AsyncSession, action: str, user_id: Any) -> list[AuditLog]:
    rows = (await db.exec(select(AuditLog).where(AuditLog.action == action))).all()
    return [row for row in rows if row.actor_id == user_id]


def is_uniform_refusal(response: Response) -> bool:
    return response.status_code == LOGIN_REFUSED_STATUS and response.json() == {
        "detail": LOGIN_REFUSED_DETAIL
    }


@pytest.fixture(autouse=True)
def _no_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


@pytest.mark.parametrize("attempt", [json_login, form_login], ids=["json-login", "access-token"])
async def test_lockout_window_comes_from_account_lockout_minutes(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
    attempt: Attempt,
) -> None:
    """Under 60 minutes, so an hours conversion would round the window to 0."""
    monkeypatch.setattr(settings, "ACCOUNT_LOCKOUT_MINUTES", LOCKOUT_MINUTES)
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)

    for _ in range(settings.MAX_LOGIN_ATTEMPTS - 1):
        response = await attempt(client, user.email, WRONG_PASSWORD)
        assert is_uniform_refusal(response), response.json()

    locking = await attempt(client, user.email, WRONG_PASSWORD)
    locked_at = datetime.now(timezone.utc)

    assert is_uniform_refusal(locking), locking.json()
    stored = await stored_user(db, user.id)
    assert stored.is_locked is True
    assert stored.locked_until is not None
    expected = locked_at + timedelta(minutes=LOCKOUT_MINUTES)
    assert abs(as_utc(stored.locked_until) - expected) < TOLERANCE

    # Both routes record each wrong password under this one event name.
    failed = await events_for(db, "oauth2_failed_login", user.id)
    assert len(failed) == settings.MAX_LOGIN_ATTEMPTS


@pytest.mark.parametrize(
    ("attempt", "locked_event"),
    [
        pytest.param(json_login, "locked_account_attempt", id="json-login"),
        pytest.param(form_login, "oauth2_locked_account_attempt", id="access-token"),
    ],
)
async def test_locked_account_refuses_the_right_password_and_keeps_its_lock(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    attempt: Attempt,
    locked_event: str,
) -> None:
    """The response used to report the time left; now only the audit event knows it was a lock."""
    locked_until = datetime.now(timezone.utc) + timedelta(hours=2, minutes=30)
    user = await user_factory.create(
        password=PASSWORD,
        verified=True,
        is_active=True,
        is_locked=True,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS,
        locked_until=locked_until.replace(tzinfo=None),
    )

    response = await attempt(client, user.email, PASSWORD)

    assert is_uniform_refusal(response), response.json()
    assert len(await events_for(db, locked_event, user.id)) == 1
    stored = await stored_user(db, user.id)
    assert stored.locked_until is not None
    assert abs(as_utc(stored.locked_until) - locked_until) < TOLERANCE


@pytest.mark.parametrize("attempt", [json_login, form_login], ids=["json-login", "access-token"])
async def test_expired_lock_lets_the_right_password_in(
    client: AsyncClient, db: AsyncSession, user_factory: Any, attempt: Attempt
) -> None:
    """Once locked_until passes, authenticate unlocks the account and the login succeeds."""
    user = await user_factory.create(
        password=PASSWORD,
        verified=True,
        is_active=True,
        is_locked=True,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS,
        locked_until=(datetime.now(timezone.utc) - timedelta(minutes=1)).replace(tzinfo=None),
    )

    response = await attempt(client, user.email, PASSWORD)

    assert response.status_code == 200, response.json()
    stored = await stored_user(db, user.id)
    assert stored.is_locked is False
    assert stored.locked_until is None
    assert stored.number_of_failed_attempts == 0


@pytest.mark.parametrize("attempt", [json_login, form_login], ids=["json-login", "access-token"])
async def test_expired_lock_counts_a_wrong_password_from_zero(
    client: AsyncClient, db: AsyncSession, user_factory: Any, attempt: Attempt
) -> None:
    """A wrong password after expiry is an ordinary first failure, not a new lock."""
    user = await user_factory.create(
        password=PASSWORD,
        verified=True,
        is_active=True,
        is_locked=True,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS,
        locked_until=(datetime.now(timezone.utc) - timedelta(minutes=1)).replace(tzinfo=None),
    )

    response = await attempt(client, user.email, WRONG_PASSWORD)

    assert is_uniform_refusal(response), response.json()
    stored = await stored_user(db, user.id)
    assert stored.is_locked is False
    assert stored.number_of_failed_attempts == 1
