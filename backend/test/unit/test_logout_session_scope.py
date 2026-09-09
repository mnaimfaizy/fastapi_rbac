"""Logout ends the calling session only; logout/all ends every session (#237).

Seams under test:
- POST /logout (the logout handler): one session, identified by the refresh
  cookie or, failing that, the access token's allowlist metadata
- POST /logout/all (the logout_all handler): every session, via
  revoke_all_user_tokens
"""

from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException, Response

from app.api.v1.endpoints.auth import logout, logout_all
from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils.token import (
    add_derived_access_token_to_redis,
    add_session_tokens_to_redis,
    add_token_to_redis,
    get_valid_tokens,
    token_is_allowlisted,
)


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


async def _establish_session(redis: MockRedisClient, user: MagicMock, tag: str) -> tuple[str, str]:
    access_token = f"access.{tag}"
    refresh_token = f"refresh.{tag}"
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token=access_token,
        refresh_token=refresh_token,
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )
    return access_token, refresh_token


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
    )


async def _allowlist_counts(redis: MockRedisClient, user_id: UUID, token_type: TokenType) -> tuple[int, int]:
    members = await redis.zrange(f"user:{user_id}:{token_type}", 0, -1)
    meta = await redis.hgetall(f"user:{user_id}:{token_type}:meta")
    return len(members), len(meta)


@pytest.mark.asyncio
async def test_logout_ends_the_calling_session_and_leaves_others() -> None:
    redis = MockRedisClient()
    user = _user()
    access_a, refresh_a = await _establish_session(redis, user, "browser-a")
    access_b, refresh_b = await _establish_session(redis, user, "browser-b")

    result = await _logout(redis, user, refresh_token=refresh_a)

    assert result.message == "Successfully logged out"  # type: ignore[attr-defined]

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(refresh_members, refresh_a) is False
    assert token_is_allowlisted(access_members, access_a) is False
    assert token_is_allowlisted(refresh_members, refresh_b) is True
    assert token_is_allowlisted(access_members, access_b) is True


@pytest.mark.asyncio
async def test_logout_rejects_every_access_token_derived_from_the_session() -> None:
    redis = MockRedisClient()
    user = _user()
    access_original, refresh = await _establish_session(redis, user, "one")
    await add_derived_access_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.refreshed",
        refresh_token=refresh,
        expire_time=15,
    )
    access_other, refresh_other = await _establish_session(redis, user, "other")

    await _logout(redis, user, refresh_token=refresh)

    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    assert token_is_allowlisted(access_members, access_original) is False
    assert token_is_allowlisted(access_members, "access.refreshed") is False
    assert token_is_allowlisted(refresh_members, refresh) is False
    assert token_is_allowlisted(access_members, access_other) is True
    assert token_is_allowlisted(refresh_members, refresh_other) is True


@pytest.mark.asyncio
async def test_logout_without_refresh_cookie_uses_access_token_metadata() -> None:
    redis = MockRedisClient()
    user = _user()
    access_a, _refresh_a = await _establish_session(redis, user, "browser-a")
    access_b, refresh_b = await _establish_session(redis, user, "browser-b")

    await _logout(redis, user, refresh_token=None, access_token=access_a)

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(access_members, access_a) is False
    assert token_is_allowlisted(refresh_members, refresh_b) is True
    assert token_is_allowlisted(access_members, access_b) is True
    # The refresh token that belongs to session A is gone even though the
    # cookie was not presented.
    assert token_is_allowlisted(refresh_members, _refresh_a) is False
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        zcard, hlen = await _allowlist_counts(redis, user.id, token_type)
        assert zcard == hlen


@pytest.mark.asyncio
async def test_logout_fails_without_a_session_id_and_does_not_revoke_others() -> None:
    redis = MockRedisClient()
    user = _user()
    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        "access.orphan",
        TokenType.ACCESS,
        expire_time=15,
        session_id=None,
    )
    access_b, refresh_b = await _establish_session(redis, user, "browser-b")

    with pytest.raises(HTTPException) as raised:
        await _logout(redis, user, refresh_token=None, access_token="access.orphan")

    assert raised.value.status_code == 400
    assert raised.value.detail == "Unable to identify the current session."

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(access_members, "access.orphan") is True
    assert token_is_allowlisted(refresh_members, refresh_b) is True
    assert token_is_allowlisted(access_members, access_b) is True


@pytest.mark.asyncio
async def test_logout_leaves_allowlist_metadata_without_orphans() -> None:
    redis = MockRedisClient()
    user = _user()
    access_a, refresh_a = await _establish_session(redis, user, "browser-a")
    await _establish_session(redis, user, "browser-b")

    await _logout(redis, user, refresh_token=refresh_a, access_token=access_a)

    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        zcard, hlen = await _allowlist_counts(redis, user.id, token_type)
        assert zcard == hlen


@pytest.mark.asyncio
async def test_logout_clears_the_refresh_cookie() -> None:
    redis = MockRedisClient()
    user = _user()
    access_a, refresh_a = await _establish_session(redis, user, "browser-a")
    response = Response()

    await _logout(redis, user, refresh_token=refresh_a, access_token=access_a, response=response)

    set_cookie = response.headers.get("set-cookie", "")
    assert settings.REFRESH_TOKEN_COOKIE_NAME in set_cookie
    assert "max-age=0" in set_cookie.lower() or "Max-Age=0" in set_cookie


@pytest.mark.asyncio
async def test_logout_all_revokes_every_session() -> None:
    redis = MockRedisClient()
    user = _user()
    _access_a, refresh_a = await _establish_session(redis, user, "browser-a")
    await _establish_session(redis, user, "browser-b")
    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        "reset.pending",
        TokenType.RESET,
        expire_time=15,
    )
    response = Response()

    result = await logout_all(
        request=_request(refresh_a),
        response=response,
        background_tasks=BackgroundTasks(),
        current_user=user,
        redis_client=redis,  # type: ignore[arg-type]
        _=None,
    )

    assert result.message == "Successfully logged out from all sessions"  # type: ignore[attr-defined]
    for token_type in (TokenType.ACCESS, TokenType.REFRESH, TokenType.RESET):
        assert await get_valid_tokens(redis, user.id, token_type) == set()  # type: ignore[arg-type]
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        zcard, hlen = await _allowlist_counts(redis, user.id, token_type)
        assert zcard == hlen
    set_cookie = response.headers.get("set-cookie", "")
    assert settings.REFRESH_TOKEN_COOKIE_NAME in set_cookie
