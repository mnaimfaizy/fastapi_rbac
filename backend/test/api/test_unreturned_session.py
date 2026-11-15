"""A session the client never receives is ended again (PR #343 review).

``/login`` and change-password open the session first, then write the
refresh cookie and build the response body. If either step fails the client
gets a 500 and no tokens, but the session stayed allowlisted: it counted
toward ``CONCURRENT_SESSION_LIMIT`` and could evict a session the user really
holds. Both handlers now end it before answering.

The failure is injected after ``sessions.open`` returns, and the outcome is
read the way a client would see it, through ``accepts`` and ``refresh``.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from test.utils import STRONG_TEST_PASSWORD, get_csrf_token, random_strong_password
from typing import Any, Dict, List

import pytest
from httpx import AsyncClient, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.v1.endpoints import auth as auth_endpoints
from app.core.config import settings
from app.utils import sessions
from app.utils.sessions import IssuedSession, SessionRejected

PASSWORD = STRONG_TEST_PASSWORD
# The client address httpx's ASGI transport gives every in-process request,
# so a refresh from here matches the origin the handler recorded.
ASGI_CLIENT = "127.0.0.1"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def accepted(redis_mock: Any, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


async def refreshes(db: AsyncSession, redis_mock: Any, refresh_token: str) -> bool:
    try:
        await sessions.refresh(refresh_token, ASGI_CLIENT, db_session=db, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


def record_opened_sessions(monkeypatch: pytest.MonkeyPatch) -> List[IssuedSession]:
    """Let ``sessions.open`` run as usual, keeping each session it issues."""
    opened: List[IssuedSession] = []
    real_open = sessions.open

    async def recording_open(*args: Any, **kwargs: Any) -> IssuedSession:
        issued = await real_open(*args, **kwargs)
        opened.append(issued)
        return issued

    monkeypatch.setattr(sessions, "open", recording_open)
    return opened


def fail_cookie_write(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken(*_: Any, **__: Any) -> None:
        raise RuntimeError("cookie write failed")

    monkeypatch.setattr(auth_endpoints, "write_session_cookie", broken)


async def login(client: AsyncClient, email: str, password: str) -> Response:
    _, headers = await get_csrf_token(client)
    return await client.post(auth_url("/login"), json={"email": email, "password": password}, headers=headers)


async def test_login_ends_the_session_when_the_cookie_write_fails(
    client: AsyncClient,
    user_factory: Any,
    redis_mock: Any,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await user_factory.create(email="unreturned-login@example.com", password=PASSWORD, verified=True)
    opened = record_opened_sessions(monkeypatch)
    fail_cookie_write(monkeypatch)

    response = await login(client, "unreturned-login@example.com", PASSWORD)

    assert response.status_code == 500, response.text
    assert len(opened) == 1
    assert await accepted(redis_mock, opened[0].access_token) is False
    assert await refreshes(db, redis_mock, opened[0].refresh_token) is False


async def test_login_ends_the_session_when_the_response_body_fails(
    client: AsyncClient,
    user_factory: Any,
    redis_mock: Any,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await user_factory.create(email="unreturned-body@example.com", password=PASSWORD, verified=True)
    opened = record_opened_sessions(monkeypatch)

    def broken(*_: Any, **__: Any) -> Dict[str, Any]:
        raise RuntimeError("serialization failed")

    monkeypatch.setattr(auth_endpoints, "serialize_user", broken)

    response = await login(client, "unreturned-body@example.com", PASSWORD)

    assert response.status_code == 500, response.text
    assert len(opened) == 1
    assert await accepted(redis_mock, opened[0].access_token) is False
    assert await refreshes(db, redis_mock, opened[0].refresh_token) is False


async def test_change_password_ends_the_new_session_when_the_cookie_write_fails(
    client: AsyncClient,
    user_factory: Any,
    redis_mock: Any,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await user_factory.create(email="unreturned-change@example.com", password=PASSWORD, verified=True)
    login_response = await login(client, "unreturned-change@example.com", PASSWORD)
    assert login_response.status_code == 200, login_response.text
    _, csrf_headers = await get_csrf_token(client)
    headers: Dict[str, str] = {
        **csrf_headers,
        "Authorization": f"Bearer {login_response.json()['data']['access_token']}",
    }
    opened = record_opened_sessions(monkeypatch)
    fail_cookie_write(monkeypatch)

    response = await client.post(
        auth_url("/change_password"),
        json={"current_password": PASSWORD, "new_password": random_strong_password()},
        headers=headers,
    )

    assert response.status_code == 500, response.text
    assert len(opened) == 1
    assert await accepted(redis_mock, opened[0].access_token) is False
    assert await refreshes(db, redis_mock, opened[0].refresh_token) is False


async def test_a_failed_login_does_not_hold_a_slot_under_the_session_limit(
    client: AsyncClient,
    user_factory: Any,
    redis_mock: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    await user_factory.create(email="unreturned-limit@example.com", password=PASSWORD, verified=True)
    held = await login(client, "unreturned-limit@example.com", PASSWORD)
    assert held.status_code == 200, held.text
    with monkeypatch.context() as broken:
        fail_cookie_write(broken)
        failed = await login(client, "unreturned-limit@example.com", PASSWORD)
    assert failed.status_code == 500, failed.text

    second = await login(client, "unreturned-limit@example.com", PASSWORD)

    assert second.status_code == 200, second.text
    # Two real sessions fit under a limit of two. Had the failed login's
    # session stayed allowlisted, this login would have evicted the first.
    assert await accepted(redis_mock, held.json()["data"]["access_token"]) is True
    assert await accepted(redis_mock, second.json()["data"]["access_token"]) is True
