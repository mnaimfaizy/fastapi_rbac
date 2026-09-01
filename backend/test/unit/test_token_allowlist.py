"""Unit tests for Redis JWT allowlist helpers (#73, #205).

Seams under test:
- token_is_allowlisted (membership / empty-set reject)
- add_token_to_redis / get_valid_tokens / revoke_user_tokens (allowlist write & clear)
- revoke_all_user_tokens (clears every type the allowlist holds)
- per-member expiry on those helpers (an entry is invalid at its own expiry)
- add_session_tokens_to_redis (session = refresh + derived access; limit eviction)
"""

from dataclasses import dataclass
from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils.token import (
    ALLOWLIST_TOKEN_TYPES,
    add_session_tokens_to_redis,
    add_token_to_redis,
    get_valid_tokens,
    revoke_all_user_tokens,
    revoke_user_tokens,
    token_is_allowlisted,
)


@dataclass
class Clock:
    now: float = 1_700_000_000.0

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    frozen = Clock()
    monkeypatch.setattr("app.utils.token.time.time", frozen.time)
    return frozen


def _user() -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    return user


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
async def test_revoke_user_tokens_clears_allowlist_so_membership_fails() -> None:
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

    await revoke_user_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    await revoke_user_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]

    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    assert token_is_allowlisted(access_members, access) is False
    assert token_is_allowlisted(refresh_members, refresh) is False


@pytest.mark.asyncio
async def test_revoke_all_user_tokens_leaves_no_type_behind() -> None:
    """A type added to the allowlist later must not survive a full revocation.

    This drives every type through the same write path the endpoints use, so a
    new `TokenType` that starts being allowlisted without being added to
    `ALLOWLIST_TOKEN_TYPES` fails here rather than in production (#206).
    """
    redis = MockRedisClient()
    user = MagicMock()
    user.id = uuid4()
    for token_type in ALLOWLIST_TOKEN_TYPES:
        await add_token_to_redis(
            redis,  # type: ignore[arg-type]
            user,
            f"{token_type}.jwt",
            token_type,
            expire_time=15,
        )

    await revoke_all_user_tokens(redis, user.id)  # type: ignore[arg-type]

    for token_type in ALLOWLIST_TOKEN_TYPES:
        assert await get_valid_tokens(redis, user.id, token_type) == set()  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_allowlist_entry_expires_independently_of_siblings(clock: Clock) -> None:
    """A member is invalid at its own expiry even if others were added later."""
    redis = MockRedisClient()
    user = _user()
    first = "first.refresh.jwt"
    second = "second.refresh.jwt"

    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        first,
        TokenType.REFRESH,
        expire_time=10,
    )
    clock.advance(5 * 60)
    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        second,
        TokenType.REFRESH,
        expire_time=10,
    )
    clock.advance(6 * 60)

    members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    assert token_is_allowlisted(members, first) is False
    assert token_is_allowlisted(members, second) is True


@pytest.mark.asyncio
async def test_token_added_to_nonempty_allowlist_keeps_full_lifetime(clock: Clock) -> None:
    redis = MockRedisClient()
    user = _user()
    early = "early.access.jwt"
    late = "late.access.jwt"

    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        early,
        TokenType.ACCESS,
        expire_time=10,
    )
    clock.advance(8 * 60)
    await add_token_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        late,
        TokenType.ACCESS,
        expire_time=10,
    )
    clock.advance(3 * 60)

    members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(members, early) is False
    assert token_is_allowlisted(members, late) is True


@pytest.mark.asyncio
async def test_live_session_count_excludes_expired_refresh_tokens(
    clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    redis = MockRedisClient()
    user = _user()

    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.0",
        refresh_token="refresh.0",
        access_expire_minutes=15,
        refresh_expire_minutes=10,
    )
    clock.advance(11 * 60)
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.1",
        refresh_token="refresh.1",
        access_expire_minutes=15,
        refresh_expire_minutes=30,
    )
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.2",
        refresh_token="refresh.2",
        access_expire_minutes=15,
        refresh_expire_minutes=30,
    )

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(refresh_members, "refresh.0") is False
    assert token_is_allowlisted(refresh_members, "refresh.1") is True
    assert token_is_allowlisted(refresh_members, "refresh.2") is True
    assert token_is_allowlisted(access_members, "access.1") is True
    assert token_is_allowlisted(access_members, "access.2") is True


@pytest.mark.asyncio
async def test_login_at_limit_evicts_oldest_session_and_its_access_tokens(
    clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    redis = MockRedisClient()
    user = _user()

    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.old",
        refresh_token="refresh.old",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )
    clock.advance(1)
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.kept",
        refresh_token="refresh.kept",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )
    clock.advance(1)
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.new",
        refresh_token="refresh.new",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(refresh_members, "refresh.old") is False
    assert token_is_allowlisted(access_members, "access.old") is False
    assert token_is_allowlisted(refresh_members, "refresh.kept") is True
    assert token_is_allowlisted(access_members, "access.kept") is True
    assert token_is_allowlisted(refresh_members, "refresh.new") is True
    assert token_is_allowlisted(access_members, "access.new") is True


@pytest.mark.asyncio
async def test_login_below_limit_does_not_evict_existing_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 5)
    redis = MockRedisClient()
    user = _user()

    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.a",
        refresh_token="refresh.a",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token="access.b",
        refresh_token="refresh.b",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
    )

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(refresh_members, "refresh.a") is True
    assert token_is_allowlisted(refresh_members, "refresh.b") is True
    assert token_is_allowlisted(access_members, "access.a") is True
    assert token_is_allowlisted(access_members, "access.b") is True


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, -1])
async def test_non_positive_session_limit_disables_enforcement(
    monkeypatch: pytest.MonkeyPatch, limit: int
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", limit)
    redis = MockRedisClient()
    user = _user()

    for index in range(6):
        await add_session_tokens_to_redis(
            redis,  # type: ignore[arg-type]
            user,
            access_token=f"access.{index}",
            refresh_token=f"refresh.{index}",
            access_expire_minutes=15,
            refresh_expire_minutes=60,
        )

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    assert len(refresh_members) == 6
    for index in range(6):
        assert token_is_allowlisted(refresh_members, f"refresh.{index}") is True
