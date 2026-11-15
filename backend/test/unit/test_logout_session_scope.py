"""Logout ends the calling session only; logout/all ends every session (#237).

Seams under test:
- POST /logout (the logout handler): one session, identified by the refresh
  cookie or, failing that, the access token
- POST /logout/all (the logout_all handler): every session, via
  ``sessions.end_all``

Sessions are opened through the Session module and the outcome is read back
through ``sessions.accepts``; the allowlist's Redis keys are not touched. That
logout/all also ends a pending reset link is asserted at the route in
``test/api/test_session_revocation.py``, where the link can be redeemed.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException, Response

from app.api.v1.endpoints.auth import logout, logout_all
from app.core.config import settings
from app.utils import sessions
from app.utils.sessions import IssuedSession, SessionRejected


@pytest.fixture(autouse=True)
def _no_session_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 0)


def _user() -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = "logout-scope@example.com"
    user.is_active = True
    return user


def _request(refresh_token: str | None = None) -> MagicMock:
    request = MagicMock()
    request.cookies = {}
    if refresh_token is not None:
        request.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token
    request.client = MagicMock(host="127.0.0.1")
    return request


async def _open(redis: MockRedisClient, user: MagicMock) -> IssuedSession:
    return await sessions.open(user, "127.0.0.1", redis_client=redis)  # type: ignore[arg-type]


async def _accepted(redis: MockRedisClient, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis)  # type: ignore[arg-type]
    except SessionRejected:
        return False
    return True


async def _logout(
    redis: MockRedisClient,
    user: MagicMock,
    *,
    refresh_token: str | None,
    access_token: str = "",
    response: Response | None = None,
) -> object:
    return await logout(
        request=_request(refresh_token),
        response=response or Response(),
        background_tasks=BackgroundTasks(),
        current_user=user,
        redis_client=redis,  # type: ignore[arg-type]
        _=None,
        access_token=access_token,
        db_session=AsyncMock(),
    )


async def _logout_all(redis: MockRedisClient, user: MagicMock, response: Response | None = None) -> object:
    return await logout_all(
        request=_request(),
        response=response or Response(),
        background_tasks=BackgroundTasks(),
        current_user=user,
        redis_client=redis,  # type: ignore[arg-type]
        db_session=AsyncMock(),
        _=None,
    )


@pytest.mark.asyncio
async def test_logout_ends_the_calling_session_and_leaves_others() -> None:
    redis = MockRedisClient()
    user = _user()
    browser_a = await _open(redis, user)
    browser_b = await _open(redis, user)

    result = await _logout(
        redis, user, refresh_token=browser_a.refresh_token, access_token=browser_a.access_token
    )

    assert result.message == "Successfully logged out"  # type: ignore[attr-defined]
    assert await _accepted(redis, browser_a.access_token) is False
    assert await _accepted(redis, browser_b.access_token) is True


@pytest.mark.asyncio
async def test_logout_with_the_cookie_ends_the_cookies_session() -> None:
    """The cookie names the session even when the bearer token is someone else's."""
    redis = MockRedisClient()
    user = _user()
    browser_a = await _open(redis, user)
    browser_b = await _open(redis, user)

    await _logout(redis, user, refresh_token=browser_a.refresh_token, access_token=browser_b.access_token)

    assert await _accepted(redis, browser_a.access_token) is False
    assert await _accepted(redis, browser_b.access_token) is True


@pytest.mark.asyncio
async def test_logout_without_refresh_cookie_uses_the_access_token() -> None:
    redis = MockRedisClient()
    user = _user()
    browser_a = await _open(redis, user)
    browser_b = await _open(redis, user)

    await _logout(redis, user, refresh_token=None, access_token=browser_a.access_token)

    assert await _accepted(redis, browser_a.access_token) is False
    assert await _accepted(redis, browser_b.access_token) is True


@pytest.mark.asyncio
async def test_logout_without_cookie_ends_an_access_only_session() -> None:
    """OAuth2 /access-token opens an access-only session and sets no refresh cookie."""
    redis = MockRedisClient()
    user = _user()
    swagger = await sessions.open_access_only(user, "127.0.0.1", redis_client=redis)  # type: ignore[arg-type]
    browser_b = await _open(redis, user)

    await _logout(redis, user, refresh_token=None, access_token=swagger)

    assert await _accepted(redis, swagger) is False
    assert await _accepted(redis, browser_b.access_token) is True


@pytest.mark.asyncio
async def test_logout_answers_400_when_no_session_is_identified_and_ends_nothing() -> None:
    redis = MockRedisClient()
    user = _user()
    browser_b = await _open(redis, user)

    with pytest.raises(HTTPException) as raised:
        await _logout(redis, user, refresh_token=None, access_token="never.issued.token")

    assert raised.value.status_code == 400
    assert raised.value.detail == "Unable to identify the current session."
    assert await _accepted(redis, browser_b.access_token) is True


@pytest.mark.asyncio
async def test_logout_clears_the_refresh_cookie() -> None:
    redis = MockRedisClient()
    user = _user()
    browser_a = await _open(redis, user)
    response = Response()

    await _logout(
        redis,
        user,
        refresh_token=browser_a.refresh_token,
        access_token=browser_a.access_token,
        response=response,
    )

    set_cookie = response.headers.get("set-cookie", "")
    assert settings.REFRESH_TOKEN_COOKIE_NAME in set_cookie
    assert "max-age=0" in set_cookie.lower()


@pytest.mark.asyncio
async def test_logout_all_ends_every_session() -> None:
    redis = MockRedisClient()
    user = _user()
    browser_a = await _open(redis, user)
    browser_b = await _open(redis, user)
    swagger = await sessions.open_access_only(user, "127.0.0.1", redis_client=redis)  # type: ignore[arg-type]
    response = Response()

    result = await _logout_all(redis, user, response)

    assert result.message == "Successfully logged out from all sessions"  # type: ignore[attr-defined]
    for access_token in (browser_a.access_token, browser_b.access_token, swagger):
        assert await _accepted(redis, access_token) is False
    set_cookie = response.headers.get("set-cookie", "")
    assert settings.REFRESH_TOKEN_COOKIE_NAME in set_cookie


@pytest.mark.asyncio
async def test_logout_all_returns_500_when_revocation_fails() -> None:
    redis = MockRedisClient()
    user = _user()
    redis.delete = AsyncMock(side_effect=RuntimeError("redis down"))

    with pytest.raises(HTTPException) as raised:
        await _logout_all(redis, user)

    assert raised.value.status_code == 500
    assert raised.value.detail == "An unexpected error occurred during logout."
