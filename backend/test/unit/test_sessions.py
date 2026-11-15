"""The Session module through its interface: open, accept, end, end_all, the limit (#279).

Every assertion reads an outcome the module promises -- whether ``accepts``
takes a token -- never the allowlist's Redis keys. Refresh needs the token's
user from the database, so the cases that go through ``refresh`` (open ->
accepts -> refresh -> end, origin anomaly, ``end_all`` leaving a reset link)
are in ``test/api/test_sessions.py`` under ADR 0012.
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

HOME = "192.0.2.10"


@dataclass
class Clock:
    now: float

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    """Wall time for allowlist expiry and ranking; JWT expiry keeps the real clock.

    Ranking sessions by when they opened needs distinct times, which a coarse
    system clock does not guarantee between two calls.
    """
    frozen = Clock(time.time())
    monkeypatch.setattr(time, "time", frozen.time)
    return frozen


@pytest.fixture
def redis() -> MockRedisClient:
    return MockRedisClient()


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


async def _open(redis: MockRedisClient, user: MagicMock) -> sessions.IssuedSession:
    return await sessions.open(user, HOME, redis_client=redis)  # type: ignore[arg-type]


async def _open_access_only(redis: MockRedisClient, user: MagicMock) -> str:
    return await sessions.open_access_only(user, HOME, redis_client=redis)  # type: ignore[arg-type]


async def _end(
    redis: MockRedisClient,
    user: MagicMock,
    *,
    refresh_token: str | None = None,
    access_token: str | None = None,
) -> None:
    await sessions.end(
        user.id,
        refresh_token=refresh_token,
        access_token=access_token,
        redis_client=redis,  # type: ignore[arg-type]
    )


# --- open, accepts, end ------------------------------------------------------


@pytest.mark.asyncio
async def test_an_opened_session_is_accepted_until_it_ends(redis: MockRedisClient) -> None:
    user = _user()
    issued = await _open(redis, user)

    accepted = await sessions.accepts(issued.access_token, redis_client=redis)  # type: ignore[arg-type]
    assert accepted == user.id

    await _end(redis, user, refresh_token=issued.refresh_token)

    assert await _accepted(redis, issued.access_token) is False


@pytest.mark.asyncio
async def test_an_access_only_session_is_accepted_until_it_ends(redis: MockRedisClient) -> None:
    user = _user()
    access_token = await _open_access_only(redis, user)

    assert await _accepted(redis, access_token) is True

    await _end(redis, user, access_token=access_token)

    assert await _accepted(redis, access_token) is False


@pytest.mark.asyncio
async def test_ending_a_session_by_its_refresh_token_leaves_the_others(redis: MockRedisClient) -> None:
    user = _user()
    phone = await _open(redis, user)
    desktop = await _open(redis, user)
    swagger = await _open_access_only(redis, user)

    await _end(redis, user, refresh_token=phone.refresh_token)

    assert await _accepted(redis, phone.access_token) is False
    assert await _accepted(redis, desktop.access_token) is True
    assert await _accepted(redis, swagger) is True


@pytest.mark.asyncio
async def test_ending_a_session_by_its_access_token_leaves_the_others(redis: MockRedisClient) -> None:
    user = _user()
    phone = await _open(redis, user)
    desktop = await _open(redis, user)

    await _end(redis, user, access_token=phone.access_token)

    assert await _accepted(redis, phone.access_token) is False
    assert await _accepted(redis, desktop.access_token) is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "access_token", [None, "never.issued.token"], ids=["nothing", "unknown-access-token"]
)
async def test_end_without_an_identifiable_session_ends_nothing(
    redis: MockRedisClient, access_token: str | None
) -> None:
    user = _user()
    kept = await _open(redis, user)

    with pytest.raises(SessionRejected) as raised:
        await _end(redis, user, access_token=access_token)

    assert raised.value.reason is RejectReason.UNIDENTIFIED
    assert await _accepted(redis, kept.access_token) is True


@pytest.mark.asyncio
async def test_end_all_ends_every_session_of_that_user_and_no_one_elses(redis: MockRedisClient) -> None:
    user = _user()
    other = _user()
    first = await _open(redis, user)
    second = await _open(redis, user)
    swagger = await _open_access_only(redis, user)
    theirs = await _open(redis, other)

    await sessions.end_all(user.id, redis_client=redis)  # type: ignore[arg-type]

    assert await _accepted(redis, first.access_token) is False
    assert await _accepted(redis, second.access_token) is False
    assert await _accepted(redis, swagger) is False
    assert await _accepted(redis, theirs.access_token) is True


# --- accepts refusals ----------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("subject", "reason"),
    [("", RejectReason.MISSING_SUBJECT), ("not-a-uuid", RejectReason.INVALID_SUBJECT)],
)
async def test_accepts_refuses_a_token_without_a_usable_subject(
    redis: MockRedisClient, subject: str, reason: RejectReason
) -> None:
    token = security.create_access_token(subject, "someone@example.com")

    with pytest.raises(SessionRejected) as raised:
        await sessions.accepts(token, redis_client=redis)  # type: ignore[arg-type]

    assert raised.value.reason is reason


# --- one refresh lifetime ----------------------------------------------------


@pytest.mark.asyncio
async def test_an_issued_session_carries_its_refresh_lifetime_as_cookie_max_age(
    redis: MockRedisClient,
) -> None:
    issued = await _open(redis, _user())

    claims = security.decode_token(issued.refresh_token, token_type="refresh")
    expected = settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60
    assert issued.refresh_max_age == expected
    # exp and iat come from two clock reads, so whole seconds may differ by one.
    assert abs((int(claims["exp"]) - int(claims["iat"])) - expected) <= 1


# --- CONCURRENT_SESSION_LIMIT --------------------------------------------------


@pytest.mark.asyncio
async def test_a_session_at_the_limit_evicts_the_oldest(
    redis: MockRedisClient, clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    user = _user()
    oldest = await _open(redis, user)
    clock.advance(1)
    kept = await _open(redis, user)
    clock.advance(1)
    newest = await _open(redis, user)

    assert await _accepted(redis, oldest.access_token) is False
    assert await _accepted(redis, kept.access_token) is True
    assert await _accepted(redis, newest.access_token) is True


@pytest.mark.asyncio
async def test_an_access_only_session_counts_toward_the_limit(
    redis: MockRedisClient, clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    user = _user()
    oldest = await _open(redis, user)
    clock.advance(1)
    swagger = await _open_access_only(redis, user)
    clock.advance(1)
    newest = await _open(redis, user)

    assert await _accepted(redis, oldest.access_token) is False
    assert await _accepted(redis, swagger) is True
    assert await _accepted(redis, newest.access_token) is True


@pytest.mark.asyncio
async def test_an_access_only_session_is_evicted_when_it_is_the_oldest(
    redis: MockRedisClient, clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 2)
    user = _user()
    swagger = await _open_access_only(redis, user)
    clock.advance(1)
    kept = await _open(redis, user)
    clock.advance(1)
    newest_swagger = await _open_access_only(redis, user)

    assert await _accepted(redis, swagger) is False
    assert await _accepted(redis, kept.access_token) is True
    assert await _accepted(redis, newest_swagger) is True


@pytest.mark.asyncio
async def test_the_session_just_opened_is_never_the_one_evicted(
    redis: MockRedisClient, clock: Clock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two sessions opened in the same instant: the new one still survives."""
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 1)
    user = _user()
    earlier = await _open(redis, user)
    later = await _open(redis, user)

    assert await _accepted(redis, earlier.access_token) is False
    assert await _accepted(redis, later.access_token) is True


@pytest.mark.asyncio
@pytest.mark.parametrize("limit", [0, -1])
async def test_a_non_positive_limit_disables_eviction(
    redis: MockRedisClient, clock: Clock, monkeypatch: pytest.MonkeyPatch, limit: int
) -> None:
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", limit)
    user = _user()
    opened = []
    for _ in range(6):
        opened.append((await _open(redis, user)).access_token)
        opened.append(await _open_access_only(redis, user))
        clock.advance(1)

    for access_token in opened:
        assert await _accepted(redis, access_token) is True
