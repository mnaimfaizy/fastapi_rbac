"""The allowlist as a caller sees it: which access tokens ``accepts`` takes (#73, #205, #279).

The allowlist is the Session module's storage, so these assert only through
``sessions.accepts``; the Redis keys are never read or written here.

- an empty allowlist accepts nothing
- each entry expires at its own time, not when its siblings do
- an expired session no longer counts toward ``CONCURRENT_SESSION_LIMIT``
- ``end_all`` leaves no kind of session behind

What happens when the stored metadata is unreadable is in
``test_allowlist_metadata.py``, the one place that writes the storage
directly, because no caller can produce that state.
"""

import time
from dataclasses import dataclass
from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core import security
from app.core.config import settings
from app.utils import sessions
from app.utils.sessions import RejectReason, SessionRejected


@dataclass
class Clock:
    now: float

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    """Wall time for allowlist expiry; JWT expiry keeps the real clock."""
    frozen = Clock(time.time())
    monkeypatch.setattr(time, "time", frozen.time)
    return frozen


def _user() -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = f"{user.id}@example.com"
    return user


async def _accepted(redis: MockRedisClient, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis)  # type: ignore[arg-type]
    except SessionRejected as rejected:
        assert rejected.reason is RejectReason.NOT_ACCEPTED
        return False
    return True


@pytest.mark.asyncio
async def test_an_empty_allowlist_accepts_nothing() -> None:
    """A correctly signed token that no session issued must not bypass enforcement."""
    token = security.create_access_token(str(uuid4()), "someone@example.com")

    assert await _accepted(MockRedisClient(), token) is False


@pytest.mark.asyncio
async def test_the_first_session_is_accepted() -> None:
    """The first login must allowlist even when the user had no entries at all."""
    redis = MockRedisClient()

    user = _user()
    access_token = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]

    assert await _accepted(redis, access_token) is True


@pytest.mark.asyncio
async def test_an_entry_expires_independently_of_its_siblings(
    clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 10)
    redis = MockRedisClient()
    user = _user()
    first = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(5 * 60)
    second = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(6 * 60)

    assert await _accepted(redis, first) is False
    assert await _accepted(redis, second) is True


@pytest.mark.asyncio
async def test_an_entry_added_to_a_nonempty_allowlist_keeps_its_full_lifetime(
    clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 10)
    redis = MockRedisClient()
    user = _user()
    early = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(8 * 60)
    late = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(3 * 60)

    assert await _accepted(redis, early) is False
    assert await _accepted(redis, late) is True


@pytest.mark.asyncio
async def test_an_expired_session_does_not_count_toward_the_limit(
    clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The first session's refresh token has expired, so the third login evicts nothing.

    Its access token outlives it here on purpose: an access token derived from
    a refresh token is not a session of its own and must not be counted.
    """
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    monkeypatch.setattr(settings, "REFRESH_TOKEN_EXPIRE_MINUTES", 10)
    monkeypatch.setattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    redis = MockRedisClient()
    user = _user()
    await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(11 * 60)
    second = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    clock.advance(1)
    third = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]

    assert await _accepted(redis, second.access_token) is True
    assert await _accepted(redis, third.access_token) is True


@pytest.mark.asyncio
async def test_end_all_leaves_no_kind_of_session_behind() -> None:
    """Both forms of session go, so a new form cannot quietly survive a full revocation (#206)."""
    redis = MockRedisClient()
    user = _user()
    login = await sessions.open(user, None, redis_client=redis)  # type: ignore[arg-type]
    swagger = await sessions.open_access_only(user, None, redis_client=redis)  # type: ignore[arg-type]

    await sessions.end_all(user.id, redis_client=redis)  # type: ignore[arg-type]

    assert await _accepted(redis, login.access_token) is False
    assert await _accepted(redis, swagger) is False
