"""Unit tests for Redis JWT allowlist helpers (#73).

Seams under test:
- token_is_allowlisted (membership / empty-set reject)
- add_token_to_redis / get_valid_tokens / delete_tokens (allowlist write & clear)
"""

from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.schemas.common_schema import TokenType
from app.utils.token import (
    add_token_to_redis,
    delete_tokens,
    get_valid_tokens,
    token_is_allowlisted,
)


def test_token_is_allowlisted_rejects_empty_set() -> None:
    """Empty allowlist must not bypass enforcement for access/refresh/reset tokens."""
    assert token_is_allowlisted(set(), "any.jwt.token") is False
    assert token_is_allowlisted(set(), "reset.jwt.token") is False


def test_token_is_allowlisted_accepts_str_member() -> None:
    token = "header.payload.sig"
    assert token_is_allowlisted({token}, token) is True


def test_token_is_allowlisted_accepts_bytes_member() -> None:
    token = "header.payload.sig"
    assert token_is_allowlisted({token.encode()}, token) is True


def test_token_is_allowlisted_rejects_unknown_token() -> None:
    assert token_is_allowlisted({"other.token"}, "header.payload.sig") is False


@pytest.mark.asyncio
async def test_add_token_to_redis_writes_on_first_login() -> None:
    """First OAuth2/JSON login must allowlist even when the Redis set was empty."""
    redis = MockRedisClient()
    user = MagicMock()
    user.id = uuid4()
    token = "first.access.token"

    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        token,
        TokenType.ACCESS,
        expire_time=15,
    )

    members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(members, token) is True


@pytest.mark.asyncio
async def test_delete_tokens_clears_allowlist_so_membership_fails() -> None:
    redis = MockRedisClient()
    user = MagicMock()
    user.id = uuid4()
    access = "access.jwt"
    refresh = "refresh.jwt"

    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access,
        TokenType.ACCESS,
        expire_time=15,
    )
    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        refresh,
        TokenType.REFRESH,
        expire_time=60,
    )

    await delete_tokens(redis, user, TokenType.ACCESS)  # type: ignore[arg-type]
    await delete_tokens(redis, user, TokenType.REFRESH)  # type: ignore[arg-type]

    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    assert token_is_allowlisted(access_members, access) is False
    assert token_is_allowlisted(refresh_members, refresh) is False


@pytest.mark.asyncio
async def test_cleanup_tokens_task_deletes_allowlist_key() -> None:
    from app.utils.background_tasks import _cleanup_tokens_task

    redis = MockRedisClient()
    user_id = uuid4()
    key = f"user:{user_id}:{TokenType.ACCESS}"
    await redis.sadd(key, "stale.token")

    await _cleanup_tokens_task(redis, user_id, TokenType.ACCESS)  # type: ignore[arg-type]

    assert await redis.smembers(key) == set()
