"""Form login opens a session like any other (#279).

``POST /access-token`` issues no refresh cookie, so its access token is the
whole session. It used to skip the concurrent-session limit and leave the
origin unrecorded. It now goes through ``sessions.open_access_only``: it
counts toward ``CONCURRENT_SESSION_LIMIT``, evicts the oldest session at the
limit, and records the client address it came from.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

import json
from test.utils import STRONG_TEST_PASSWORD, get_csrf_token
from typing import Any

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.utils import sessions
from app.utils.sessions import SessionRejected

PASSWORD = STRONG_TEST_PASSWORD
ASGI_CLIENT = "127.0.0.1"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def form_login(client: AsyncClient, email: str) -> str:
    response = await client.post(auth_url("/access-token"), data={"username": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return str(response.json()["data"]["access_token"])


async def json_login(client: AsyncClient, email: str) -> str:
    _, headers = await get_csrf_token(client)
    response = await client.post(
        auth_url("/login"), json={"email": email, "password": PASSWORD}, headers=headers
    )
    assert response.status_code == 200, response.text
    return str(response.json()["data"]["access_token"])


async def accepted(redis_mock: Any, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


async def test_form_login_evicts_the_oldest_form_login_at_the_limit(
    client: AsyncClient, user_factory: Any, redis_mock: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 1)
    await user_factory.create(email="formlimit@example.com", password=PASSWORD, verified=True)

    first = await form_login(client, "formlimit@example.com")
    second = await form_login(client, "formlimit@example.com")

    assert await accepted(redis_mock, first) is False
    assert await accepted(redis_mock, second) is True


async def test_form_login_counts_against_sessions_opened_by_json_login(
    client: AsyncClient, user_factory: Any, redis_mock: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 1)
    await user_factory.create(email="formmixed@example.com", password=PASSWORD, verified=True)

    browser = await json_login(client, "formmixed@example.com")
    script = await form_login(client, "formmixed@example.com")

    assert await accepted(redis_mock, browser) is False
    assert await accepted(redis_mock, script) is True


async def test_form_login_below_the_limit_evicts_nothing(
    client: AsyncClient, user_factory: Any, redis_mock: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    await user_factory.create(email="formroom@example.com", password=PASSWORD, verified=True)

    first = await form_login(client, "formroom@example.com")
    second = await form_login(client, "formroom@example.com")

    assert await accepted(redis_mock, first) is True
    assert await accepted(redis_mock, second) is True


async def test_form_login_records_the_client_origin(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """Spelled as ``app.utils.allowlist`` writes it, like ``test_refresh_lifetime``."""
    user = await user_factory.create(email="formorigin@example.com", password=PASSWORD, verified=True)
    user_id = user.id

    token = await form_login(client, "formorigin@example.com")

    raw = await redis_mock.hget(f"user:{user_id}:access_token:meta", token)
    assert raw is not None, "the form-login token is not allowlisted"
    meta = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
    assert meta["origin_ip"] == ASGI_CLIENT
