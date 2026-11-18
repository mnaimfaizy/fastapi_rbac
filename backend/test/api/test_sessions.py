"""The Session module through its interface, where a case needs the token's user (#279).

``refresh`` looks the user up, so the cases that go through it use the
in-process SQLite database (ADR 0012). The rest of the module's interface is
covered without a database in ``test/unit/test_sessions.py``. Outcomes are
read back through ``accepts``, ``refresh`` and the persisted security events,
never the allowlist's Redis keys.
"""

import time
from dataclasses import dataclass
from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any, List

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils import emailed_links, sessions
from app.utils.allowlist import get_valid_tokens
from app.utils.emailed_links import LinkKind
from app.utils.sessions import RejectReason, SessionRejected

HOME = "192.0.2.10"
OTHER_NETWORK = "198.51.100.10"


@dataclass
class Clock:
    now: float

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture(autouse=True)
def _settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", True)
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 0)
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


async def _accepted(redis: MockRedisClient, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis)  # type: ignore[arg-type]
    except SessionRejected:
        return False
    return True


async def _refresh(
    redis: MockRedisClient, db: AsyncSession, refresh_token: str, client_address: str | None = HOME
) -> sessions.RefreshedSession:
    return await sessions.refresh(
        refresh_token, client_address, db_session=db, redis_client=redis  # type: ignore[arg-type]
    )


async def _refused(
    redis: MockRedisClient, db: AsyncSession, refresh_token: str, client_address: str | None = HOME
) -> RejectReason:
    with pytest.raises(SessionRejected) as raised:
        await _refresh(redis, db, refresh_token, client_address)
    return raised.value.reason


async def _event_names(db: AsyncSession) -> List[str]:
    result = await db.exec(select(AuditLog).order_by(AuditLog.id))
    return [row.action for row in result.all()]


async def _user(user_factory: Any, **overrides: Any) -> User:
    return await user_factory.create(verified=True, is_active=True, **overrides)


@pytest.mark.asyncio
async def test_open_accepts_refresh_end(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory)
    issued = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    assert await _accepted(redis_mock, issued.access_token) is True

    refreshed = await _refresh(redis_mock, db, issued.refresh_token)
    assert refreshed.user.id == user.id
    assert refreshed.access_token != issued.access_token
    assert await _accepted(redis_mock, refreshed.access_token) is True

    await sessions.end(
        user.id,
        refresh_token=issued.refresh_token,
        access_token=None,
        redis_client=redis_mock,  # type: ignore[arg-type]
    )

    # Every access token of the session goes, the refreshed one included.
    assert await _accepted(redis_mock, issued.access_token) is False
    assert await _accepted(redis_mock, refreshed.access_token) is False
    assert await _refused(redis_mock, db, issued.refresh_token) is RejectReason.NOT_ACCEPTED


@pytest.mark.asyncio
async def test_ending_by_access_token_ends_the_sessions_refresh_token_too(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory)
    ended = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    kept = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]

    await sessions.end(
        user.id,
        refresh_token=None,
        access_token=ended.access_token,
        redis_client=redis_mock,  # type: ignore[arg-type]
    )

    assert await _refused(redis_mock, db, ended.refresh_token) is RejectReason.NOT_ACCEPTED
    assert (await _refresh(redis_mock, db, kept.refresh_token)).access_token


@pytest.mark.asyncio
async def test_end_all_touches_nothing_but_sessions(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """A pending reset link outlives ``end_all``; only ``emailed_links.revoke`` ends it."""
    user = await _user(user_factory)
    first = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    second = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    reset_link = await emailed_links.issue(
        LinkKind.PASSWORD_RESET, user, redis=redis_mock  # type: ignore[arg-type]
    )

    await sessions.end_all(user.id, redis_client=redis_mock)  # type: ignore[arg-type]

    for issued in (first, second):
        assert await _accepted(redis_mock, issued.access_token) is False
        assert await _refused(redis_mock, db, issued.refresh_token) is RejectReason.NOT_ACCEPTED

    redeemed: List[User] = []

    async def act(redeeming: User) -> None:
        redeemed.append(redeeming)

    await emailed_links.redeem_password_reset(
        reset_link, act, client_address=HOME, db_session=db, redis=redis_mock  # type: ignore[arg-type]
    )
    assert [u.id for u in redeemed] == [user.id]


@pytest.mark.asyncio
async def test_origin_anomaly_ends_that_session_only(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory)
    phone = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    desktop = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]

    assert await _refused(redis_mock, db, phone.refresh_token, OTHER_NETWORK) is RejectReason.NOT_ACCEPTED

    assert await _accepted(redis_mock, phone.access_token) is False
    # Ended, not merely refused once: the phone cannot refresh even from home.
    assert await _refused(redis_mock, db, phone.refresh_token, HOME) is RejectReason.NOT_ACCEPTED
    assert await _accepted(redis_mock, desktop.access_token) is True
    assert (await _refresh(redis_mock, db, desktop.refresh_token)).access_token
    assert "refresh_origin_network_mismatch" in await _event_names(db)


@pytest.mark.asyncio
async def test_a_refresh_token_no_session_holds_is_refused_and_recorded(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    user = await _user(user_factory)
    issued = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    await sessions.end_all(user.id, redis_client=redis_mock)  # type: ignore[arg-type]

    assert await _refused(redis_mock, db, issued.refresh_token) is RejectReason.NOT_ACCEPTED
    assert await _event_names(db) == ["refresh_token_invalid"]


@pytest.mark.asyncio
async def test_setting_is_active_false_directly_does_not_refuse_refresh(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """The temporary ``is_active`` check is gone (#281, ADR 0011).

    A direct edit of the flag does not end the session. Refusal is the
    allowlist, which only the disable operation updates.
    """
    user = await _user(user_factory)
    issued = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    user.is_active = False
    db.add(user)
    await db.commit()

    refreshed = await _refresh(redis_mock, db, issued.refresh_token)
    assert refreshed.access_token
    assert "refresh_token_user_not_found_or_inactive" not in await _event_names(db)


@pytest.mark.asyncio
async def test_disable_refuses_the_old_refresh_token_by_the_allowlist(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """Disable ends the session, so refresh is the ordinary allowlist refusal."""
    from app.utils.account_disable import disable_user

    user = await _user(user_factory)
    issued = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    await disable_user(user, actor=None, db_session=db, redis_client=redis_mock)  # type: ignore[arg-type]

    assert await _refused(redis_mock, db, issued.refresh_token) is RejectReason.NOT_ACCEPTED
    assert "refresh_token_user_not_found_or_inactive" not in await _event_names(db)


@pytest.mark.asyncio
async def test_open_refuses_an_inactive_user_without_a_session(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """A disable that has committed is visible to the next open."""
    user = await _user(user_factory)
    user.is_active = False
    db.add(user)
    await db.commit()

    with pytest.raises(SessionRejected) as raised:
        await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]

    assert raised.value.reason is RejectReason.USER_UNAVAILABLE
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        assert await get_valid_tokens(redis_mock, user.id, token_type) == set()


@pytest.mark.asyncio
async def test_a_session_opened_during_disable_commit_does_not_survive(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The second ending runs after the commit, so an open in that window dies."""
    from app.utils.account_disable import disable_user

    user = await _user(user_factory)
    real_commit = db.commit

    async def commit_and_open() -> None:
        await real_commit()
        # Detached, and still marked active: the in-flight login's object.
        stale = User(id=user.id, email=user.email, is_active=True)
        await sessions.open(stale, HOME, redis_client=redis_mock)  # type: ignore[arg-type]

    monkeypatch.setattr(db, "commit", commit_and_open)
    await disable_user(user, actor=None, db_session=db, redis_client=redis_mock)  # type: ignore[arg-type]

    assert user.is_active is False
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        assert await get_valid_tokens(redis_mock, user.id, token_type) == set()


@pytest.mark.asyncio
async def test_a_refreshed_access_token_is_evicted_with_its_session(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Eviction at the limit reaches an access token issued long after the login."""
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 1)
    clock = Clock(time.time())
    monkeypatch.setattr(time, "time", clock.time)
    user = await _user(user_factory)
    first = await sessions.open(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]
    refreshed = await _refresh(redis_mock, db, first.refresh_token)
    clock.advance(1)

    await sessions.open_access_only(user, HOME, redis_client=redis_mock)  # type: ignore[arg-type]

    assert await _accepted(redis_mock, refreshed.access_token) is False
    assert await _refused(redis_mock, db, first.refresh_token) is RejectReason.NOT_ACCEPTED
