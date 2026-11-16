"""Sessions keep working when the allowlist's stored metadata is unreadable.

The metadata hash and the token sorted set are written as two operations and
can be observed apart: a crash between them, a partial restore, or an eviction
of the hash alone all leave a token whose metadata is missing or unusable.
Every reader falls back rather than raising, which is what keeps a login
working in that state instead of answering 500.

No caller of the Session module can produce that state, so this is the one
test file that writes the allowlist's storage directly. It still reads the
outcome through ``sessions.accepts``, except where the property is the shape
of storage itself (no orphaned metadata).
"""

import json
import time
from dataclasses import dataclass
from test.fixtures.mock_redis_client import MockRedisClient
from typing import Callable
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app.core.config import settings
from app.schemas.common_schema import TokenType
from app.utils import sessions
from app.utils.allowlist import _allowlist_key, _allowlist_meta_key, _extend_key_ttl
from app.utils.sessions import SessionRejected


@dataclass
class Clock:
    now: float

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    frozen = Clock(time.time())
    monkeypatch.setattr(time, "time", frozen.time)
    return frozen


def _user() -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = f"{user.id}@example.com"
    return user


def _refresh_meta(redis: MockRedisClient, user_id: UUID) -> dict:
    """Spelled exactly as ``app.utils.allowlist`` writes it, so a re-key cannot pass."""
    return redis._hashes[_allowlist_meta_key(user_id, TokenType.REFRESH)]


async def _accepted(redis: MockRedisClient, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis)  # type: ignore[arg-type]
    except SessionRejected:
        return False
    return True


def _missing(meta: dict, token: str) -> None:
    del meta[token]


def _not_json(meta: dict, token: str) -> None:
    meta[token] = "{not valid json"


def _json_scalar(meta: dict, token: str) -> None:
    # json.loads succeeds, so this exercises the isinstance guard, not the decode error.
    meta[token] = '"a string"'


def _issued_at(value: object) -> Callable[[dict, str], None]:
    def write(meta: dict, token: str) -> None:
        current = json.loads(meta[token])
        meta[token] = json.dumps({**current, "issued_at": value})

    return write


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "corrupt",
    [_missing, _not_json, _json_scalar, _issued_at("not-a-number"), _issued_at(None), _issued_at([1, 2])],
    ids=["missing", "not-json", "json-scalar", "issued-at-text", "issued-at-null", "issued-at-list"],
)
async def test_a_session_with_unreadable_metadata_ranks_oldest_and_is_evicted(
    clock: Clock, monkeypatch: pytest.MonkeyPatch, corrupt: Callable[[dict, str], None]
) -> None:
    """Unreadable metadata reads as issued at 0.0, so that session is the one dropped.

    Eviction then falls back to deriving the session id from the refresh token,
    which still reaches the session's access token.
    """
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 1)
    redis = MockRedisClient()
    user = _user()
    damaged = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    corrupt(_refresh_meta(redis, user.id), damaged.refresh_token)
    clock.advance(1)

    fresh = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]

    assert await _accepted(redis, damaged.access_token) is False
    assert await _accepted(redis, fresh.access_token) is True


@pytest.mark.asyncio
async def test_ending_a_session_leaves_no_orphaned_metadata() -> None:
    redis = MockRedisClient()
    user = _user()
    ended = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    swagger = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]

    await sessions.end(
        user.id,
        refresh_token=ended.refresh_token,
        access_token=None,
        redis_client=redis,  # type: ignore[arg-type]
    )
    await sessions.end(
        user.id, refresh_token=None, access_token=swagger, redis_client=redis  # type: ignore[arg-type]
    )

    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        members = await redis.zrange(_allowlist_key(user.id, token_type), 0, -1)
        meta = await redis.hgetall(_allowlist_meta_key(user.id, token_type))
        assert len(members) == len(meta) == 1


@pytest.mark.asyncio
async def test_extend_key_ttl_is_a_noop_for_an_empty_allowlist() -> None:
    """No members means no deadline to extend to, so no expiry is written.

    Called directly: a session always adds a member before extending, so this
    guard is unreachable through the module. Without it the max() below it
    would raise on an empty sequence.
    """
    redis = MockRedisClient()

    await _extend_key_ttl(redis, uuid4(), TokenType.REFRESH)  # type: ignore[arg-type]

    redis.expireat.assert_not_awaited()
