"""Origin-network anomaly detection on refresh (#69, ADR 0011 decision 5).

``VALIDATE_TOKEN_IP`` records the address a session was established from and
compares it, at /24 or /64 granularity, when a refresh token is presented. A
mismatch ends that one session and records a security event; it does not
block a request, does not check access tokens, and does not touch the user's
other sessions.

Everything here is read back through ``sessions.refresh`` and
``sessions.accepts`` outcomes, the persisted security events, and the HTTP
answer -- never the allowlist's Redis keys. Refresh looks the token's user up,
so these use the in-process database (ADR 0012).
"""

import logging
from test.fixtures.mock_redis_client import MockRedisClient
from test.utils import get_csrf_token
from typing import Any, List

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.utils import sessions
from app.utils.sessions import RejectReason, SessionRejected

HOME = "192.0.2.10"
SAME_NETWORK = "192.0.2.200"
OTHER_NETWORK = "198.51.100.10"
# The client address httpx's ASGI transport gives every in-process request.
ASGI_CLIENT = "127.0.0.1"


@pytest.fixture(autouse=True)
def _origin_check_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", True)
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 0)


async def _user(user_factory: Any) -> User:
    return await user_factory.create(verified=True, is_active=True)


async def _open(redis: MockRedisClient, user: User, origin: str | None) -> sessions.IssuedSession:
    return await sessions.open(user, origin, redis_client=redis)  # type: ignore[arg-type]


async def _refreshes(
    redis: MockRedisClient, db: AsyncSession, refresh_token: str, client_address: str
) -> bool:
    try:
        await sessions.refresh(
            refresh_token, client_address, db_session=db, redis_client=redis  # type: ignore[arg-type]
        )
    except SessionRejected as rejected:
        # An origin mismatch must be indistinguishable from an invalid token.
        assert rejected.reason is RejectReason.NOT_ACCEPTED
        return False
    return True


async def _accepted(redis: MockRedisClient, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis)  # type: ignore[arg-type]
    except SessionRejected:
        return False
    return True


async def _event_names(db: AsyncSession) -> List[str]:
    result = await db.exec(select(AuditLog).order_by(AuditLog.id))
    return [row.action for row in result.all()]


# --- The verdict -------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("origin", "client_address", "refreshes"),
    [
        (HOME, SAME_NETWORK, True),
        (HOME, OTHER_NETWORK, False),
        # An IPv4-mapped origin compares as its dotted quad.
        (f"::ffff:{HOME}", SAME_NETWORK, True),
        (f"::ffff:{HOME}", OTHER_NETWORK, False),
        # IPv6 compares at /64.
        ("2001:db8:1:2::5", "2001:db8:1:2:aaaa::9", True),
        ("2001:db8:1:2::5", "2001:db8:1:3::5", False),
    ],
    ids=["v4-same", "v4-other", "mapped-same", "mapped-other", "v6-same-64", "v6-other-64"],
)
async def test_refresh_compares_the_origin_network(
    db: AsyncSession,
    user_factory: Any,
    redis_mock: MockRedisClient,
    origin: str,
    client_address: str,
    refreshes: bool,
) -> None:
    issued = await _open(redis_mock, await _user(user_factory), origin)

    assert await _refreshes(redis_mock, db, issued.refresh_token, client_address) is refreshes


@pytest.mark.asyncio
async def test_a_session_with_no_recorded_origin_is_never_anomalous(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """A session opened without a client address refreshes from anywhere."""
    issued = await _open(redis_mock, await _user(user_factory), None)

    assert await _refreshes(redis_mock, db, issued.refresh_token, OTHER_NETWORK) is True


@pytest.mark.asyncio
async def test_disabling_the_setting_disables_the_check(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", False)
    issued = await _open(redis_mock, await _user(user_factory), HOME)

    assert await _refreshes(redis_mock, db, issued.refresh_token, OTHER_NETWORK) is True


# --- What a mismatch does ------------------------------------------------------


@pytest.mark.asyncio
async def test_a_refresh_from_the_same_network_keeps_the_session(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    issued = await _open(redis_mock, await _user(user_factory), HOME)

    assert await _refreshes(redis_mock, db, issued.refresh_token, SAME_NETWORK) is True
    assert await _refreshes(redis_mock, db, issued.refresh_token, HOME) is True
    assert "refresh_origin_network_mismatch" not in await _event_names(db)


@pytest.mark.asyncio
async def test_a_mismatch_ends_that_session_and_leaves_the_others(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """A phone changing networks must not log out the desktop."""
    user = await _user(user_factory)
    phone = await _open(redis_mock, user, HOME)
    desktop = await _open(redis_mock, user, HOME)

    assert await _refreshes(redis_mock, db, phone.refresh_token, OTHER_NETWORK) is False

    assert await _accepted(redis_mock, phone.access_token) is False
    assert await _refreshes(redis_mock, db, phone.refresh_token, HOME) is False
    assert await _accepted(redis_mock, desktop.access_token) is True
    assert await _refreshes(redis_mock, db, desktop.refresh_token, HOME) is True


@pytest.mark.asyncio
async def test_a_mismatch_records_a_distinguishable_security_event(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """Separable from ordinary refresh failures, so the anomaly rate can be measured."""
    issued = await _open(redis_mock, await _user(user_factory), HOME)

    await _refreshes(redis_mock, db, issued.refresh_token, OTHER_NETWORK)

    assert await _event_names(db) == ["refresh_origin_network_mismatch"]


@pytest.mark.asyncio
async def test_a_mismatch_is_logged_where_it_can_be_counted(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, caplog: pytest.LogCaptureFixture
) -> None:
    """Logged as well, so the rate is countable without reading AuditLog rows."""
    issued = await _open(redis_mock, await _user(user_factory), HOME)

    with caplog.at_level(logging.WARNING, logger="fastapi_rbac"):
        await _refreshes(redis_mock, db, issued.refresh_token, OTHER_NETWORK)

    assert any("refresh_origin_network_mismatch" in record.getMessage() for record in caplog.records)


@pytest.mark.asyncio
async def test_an_ordinary_refresh_logs_no_anomaly(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, caplog: pytest.LogCaptureFixture
) -> None:
    issued = await _open(redis_mock, await _user(user_factory), HOME)

    with caplog.at_level(logging.WARNING, logger="fastapi_rbac"):
        await _refreshes(redis_mock, db, issued.refresh_token, SAME_NETWORK)

    assert not any("refresh_origin_network_mismatch" in record.getMessage() for record in caplog.records)


# --- Over HTTP -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_route_answers_a_mismatch_as_an_invalid_refresh_token(
    client: AsyncClient, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """The ordinary refusal: a caller must not learn the address gave it away."""
    issued = await _open(redis_mock, await _user(user_factory), OTHER_NETWORK)
    _, headers = await get_csrf_token(client)
    client.cookies.set(settings.REFRESH_TOKEN_COOKIE_NAME, issued.refresh_token)

    response = await client.post(f"{settings.API_V1_STR}/auth/new_access_token", headers=headers)

    assert response.status_code == 403, response.text
    assert response.json() == {"detail": {"status": False, "message": "Refresh token invalid"}}


@pytest.mark.asyncio
async def test_an_access_token_is_never_refused_on_origin_grounds(
    client: AsyncClient, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """The comparison happens at refresh only (ADR 0011 decision 5)."""
    issued = await _open(redis_mock, await _user(user_factory), OTHER_NETWORK)
    assert ASGI_CLIENT != OTHER_NETWORK

    response = await client.get(
        f"{settings.API_V1_STR}/users/me", headers={"Authorization": f"Bearer {issued.access_token}"}
    )

    assert response.status_code == 200, response.text
