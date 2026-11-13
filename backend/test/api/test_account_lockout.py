"""Account lockout is applied once, from ACCOUNT_LOCKOUT_MINUTES (#275).

``crud.user.increment_failed_attempts`` sets the lock window when the
attempt that reaches ``MAX_LOGIN_ATTEMPTS`` fails. Nothing queued after the
request may shorten or lengthen it: the JSON login used to truncate the
window to whole hours (0 for anything under 60 minutes) and the form login
hard-coded 24 hours. The stored ``locked_until`` is read back from the
database after the request and its background tasks have finished.

In ``test/api/`` because they boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import re
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

PASSWORD = STRONG_TEST_PASSWORD
WRONG_PASSWORD = PASSWORD[::-1]
LOCKOUT_MINUTES = 5
TOLERANCE = timedelta(seconds=30)
REMAINING_TIME = re.compile(r"Try again in (?:(\d+) hours and )?(\d+) minutes\.")

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


def remaining_minutes(response: Response) -> int:
    match = REMAINING_TIME.search(response.json()["detail"]["message"])
    assert match, response.json()
    hours, minutes = match.groups()
    return int(hours or 0) * 60 + int(minutes)


@pytest.mark.parametrize(
    ("attempt", "locked_status"),
    [
        pytest.param(json_login, 422, id="json-login"),
        pytest.param(form_login, 400, id="access-token"),
    ],
)
async def test_lockout_window_comes_from_account_lockout_minutes(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    monkeypatch: pytest.MonkeyPatch,
    attempt: Attempt,
    locked_status: int,
) -> None:
    """Under 60 minutes, so an hours conversion would round the window to 0."""
    monkeypatch.setattr(settings, "ACCOUNT_LOCKOUT_MINUTES", LOCKOUT_MINUTES)
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)

    for _ in range(settings.MAX_LOGIN_ATTEMPTS - 1):
        response = await attempt(client, user.email, WRONG_PASSWORD)
        assert response.status_code == 422, response.json()

    locking = await attempt(client, user.email, WRONG_PASSWORD)
    locked_at = datetime.now(timezone.utc)

    assert locking.status_code == locked_status, locking.json()
    stored = await stored_user(db, user.id)
    assert stored.is_locked is True
    assert stored.locked_until is not None
    expected = locked_at + timedelta(minutes=LOCKOUT_MINUTES)
    assert abs(as_utc(stored.locked_until) - expected) < TOLERANCE

    assert remaining_minutes(locking) in (LOCKOUT_MINUTES - 1, LOCKOUT_MINUTES)
    # Both routes record each wrong password under this one event name.
    failed = await events_for(db, "oauth2_failed_login", user.id)
    assert len(failed) == settings.MAX_LOGIN_ATTEMPTS


@pytest.mark.parametrize(
    ("attempt", "locked_status", "locked_event"),
    [
        pytest.param(json_login, 422, "locked_account_attempt", id="json-login"),
        pytest.param(form_login, 400, "oauth2_locked_account_attempt", id="access-token"),
    ],
)
async def test_locked_response_reports_time_left_on_the_stored_lock(
    client: AsyncClient,
    db: AsyncSession,
    user_factory: Any,
    attempt: Attempt,
    locked_status: int,
    locked_event: str,
) -> None:
    """The message is computed from locked_until, not from the setting."""
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

    assert response.status_code == locked_status, response.json()
    assert remaining_minutes(response) in (149, 150)
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

    assert response.status_code == 422, response.json()
    stored = await stored_user(db, user.id)
    assert stored.is_locked is False
    assert stored.number_of_failed_attempts == 1
