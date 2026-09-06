"""Origin-network anomaly detection on refresh (#69, ADR 0011 decision 5).

``VALIDATE_TOKEN_IP`` records the address a session was established from and
compares it, at /24 or /64 granularity, when a refresh token is presented. A
mismatch revokes that one session and emits a security event; it does not block
a request, does not touch access tokens, and does not touch the user's other
sessions.

Seams under test:
- the origin recorded with an allowlist entry (``session_origin_ip``)
- the verdict (``refresh_origin_is_anomalous``), including the setting gate
- the revocation primitive (``revoke_session``)
- the refresh endpoint, where the verdict turns into a response
- the access path, which must never consult the origin at all
"""

import logging
from test.fixtures.mock_redis_client import MockRedisClient
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.v1.endpoints.auth import get_new_access_token
from app.core import security
from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.token import (
    add_session_tokens_to_redis,
    get_valid_tokens,
    refresh_origin_is_anomalous,
    revoke_session,
    session_origin_ip,
    token_is_allowlisted,
)

HOME = "192.0.2.10"
SAME_NETWORK = "192.0.2.200"
OTHER_NETWORK = "198.51.100.10"


@pytest.fixture(autouse=True)
def _origin_check_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", True)
    monkeypatch.setattr(settings, "CONCURRENT_SESSION_LIMIT", 0)


def _user() -> MagicMock:
    user = MagicMock()
    user.id = uuid4()
    user.email = "session-origin@example.com"
    user.is_active = True
    return user


async def _establish_session(
    redis: MockRedisClient,
    user: MagicMock,
    tag: str,
    origin_ip: str | None = None,
    refresh_token: str | None = None,
) -> str:
    """Record one session and return its refresh token.

    ``tag`` names the pair for readable assertions; the endpoint tests pass a
    real signed ``refresh_token`` instead, because the endpoint decodes it.
    """
    refresh_token = refresh_token or f"refresh.{tag}"
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token=f"access.{tag}",
        refresh_token=refresh_token,
        access_expire_minutes=15,
        refresh_expire_minutes=60,
        origin_ip=origin_ip,
    )
    return refresh_token


# --- What a session records --------------------------------------------------


@pytest.mark.asyncio
async def test_session_records_the_full_establishing_address() -> None:
    """The full address is stored, not the truncated network.

    Recording only the /24 would prevent tightening the comparison later
    without a data migration (ADR 0011 decision 5).
    """
    redis = MockRedisClient()
    user = _user()

    await _establish_session(redis, user, "one", HOME)

    assert await session_origin_ip(redis, user.id, "refresh.one") == HOME  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_session_established_without_an_address_records_none() -> None:
    redis = MockRedisClient()
    user = _user()

    await _establish_session(redis, user, "one")

    assert await session_origin_ip(redis, user.id, "refresh.one") is None  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_session_origin_is_none_when_metadata_is_unreadable() -> None:
    """The zset and the metadata hash are written separately and can be
    observed apart, so an unusable read is absent rather than an error."""
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", HOME)
    redis._hashes[f"user:{user.id}:{TokenType.REFRESH}:meta"]["refresh.one"] = "{not json"

    assert await session_origin_ip(redis, user.id, "refresh.one") is None  # type: ignore[arg-type]


# --- The verdict -------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_from_the_same_network_is_not_anomalous() -> None:
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", HOME)

    verdict = await refresh_origin_is_anomalous(
        redis, user.id, "refresh.one", SAME_NETWORK  # type: ignore[arg-type]
    )

    assert verdict is False


@pytest.mark.asyncio
async def test_refresh_from_a_different_network_is_anomalous() -> None:
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", HOME)

    verdict = await refresh_origin_is_anomalous(
        redis, user.id, "refresh.one", OTHER_NETWORK  # type: ignore[arg-type]
    )

    assert verdict is True


@pytest.mark.asyncio
async def test_session_with_no_recorded_origin_is_never_anomalous() -> None:
    """A session established before this shipped refreshes normally."""
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one")

    verdict = await refresh_origin_is_anomalous(
        redis, user.id, "refresh.one", OTHER_NETWORK  # type: ignore[arg-type]
    )

    assert verdict is False


@pytest.mark.asyncio
async def test_disabling_the_setting_disables_the_check(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", False)
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", HOME)

    verdict = await refresh_origin_is_anomalous(
        redis, user.id, "refresh.one", OTHER_NETWORK  # type: ignore[arg-type]
    )

    assert verdict is False


@pytest.mark.asyncio
async def test_ipv4_mapped_address_matches_its_dotted_quad_session() -> None:
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", f"::ffff:{HOME}")

    assert (
        await refresh_origin_is_anomalous(
            redis, user.id, "refresh.one", SAME_NETWORK  # type: ignore[arg-type]
        )
        is False
    )
    assert (
        await refresh_origin_is_anomalous(
            redis, user.id, "refresh.one", OTHER_NETWORK  # type: ignore[arg-type]
        )
        is True
    )


@pytest.mark.asyncio
async def test_ipv6_session_compares_at_slash_64() -> None:
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "one", "2001:db8:1:2::5")

    assert (
        await refresh_origin_is_anomalous(
            redis, user.id, "refresh.one", "2001:db8:1:2:aaaa::9"  # type: ignore[arg-type]
        )
        is False
    )
    assert (
        await refresh_origin_is_anomalous(
            redis, user.id, "refresh.one", "2001:db8:1:3::5"  # type: ignore[arg-type]
        )
        is True
    )


# --- Revoking one session ----------------------------------------------------


@pytest.mark.asyncio
async def test_revoke_session_removes_only_that_session() -> None:
    """A phone changing networks must not log out the desktop."""
    redis = MockRedisClient()
    user = _user()
    await _establish_session(redis, user, "phone", HOME)
    await _establish_session(redis, user, "desktop", HOME)

    await revoke_session(redis, user.id, "refresh.phone")  # type: ignore[arg-type]

    refresh_members = await get_valid_tokens(redis, user.id, TokenType.REFRESH)  # type: ignore[arg-type]
    access_members = await get_valid_tokens(redis, user.id, TokenType.ACCESS)  # type: ignore[arg-type]
    assert token_is_allowlisted(refresh_members, "refresh.phone") is False
    assert token_is_allowlisted(access_members, "access.phone") is False
    assert token_is_allowlisted(refresh_members, "refresh.desktop") is True
    assert token_is_allowlisted(access_members, "access.desktop") is True


# --- The refresh endpoint ----------------------------------------------------


def _request(refresh_token: str, client_ip: str | None) -> MagicMock:
    request = MagicMock()
    request.cookies = {settings.REFRESH_TOKEN_COOKIE_NAME: refresh_token}
    request.client = MagicMock(host=client_ip) if client_ip else None
    return request


def _db_user(user_id: UUID) -> User:
    return User(id=user_id, email="session-origin@example.com", is_active=True)


def _queued_event_types(background_tasks: BackgroundTasks) -> list[str]:
    return [task.kwargs.get("event_type") for task in background_tasks.tasks]


@pytest.fixture
def refreshing_user(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """A user the refresh endpoint can look up, with its database read stubbed."""
    user = _user()
    monkeypatch.setattr("app.crud.user.get", AsyncMock(return_value=_db_user(user.id)))
    return user


async def _seed_refresh_session(redis: MockRedisClient, user: MagicMock, origin_ip: str | None = None) -> str:
    """A session whose refresh token is a real JWT the endpoint can decode."""
    return await _establish_session(
        redis,
        user,
        "one",
        origin_ip=origin_ip,
        refresh_token=security.create_refresh_token(str(user.id)),
    )


async def _refresh(
    redis: MockRedisClient,
    refresh_token: str,
    client_ip: str | None,
    background_tasks: BackgroundTasks,
) -> object:
    return await get_new_access_token(
        request=_request(refresh_token, client_ip),
        body=None,
        background_tasks=background_tasks,
        redis_client=redis,  # type: ignore[arg-type]
        db_session=MagicMock(),
        _=None,
    )


@pytest.mark.asyncio
async def test_refresh_from_the_same_network_succeeds_and_keeps_the_session(
    refreshing_user: MagicMock,
) -> None:
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)
    background_tasks = BackgroundTasks()

    response = await _refresh(redis, refresh_token, SAME_NETWORK, background_tasks)

    assert response.data.access_token  # type: ignore[attr-defined]
    refresh_members = await get_valid_tokens(  # type: ignore[arg-type]
        redis, refreshing_user.id, TokenType.REFRESH
    )
    assert token_is_allowlisted(refresh_members, refresh_token) is True
    assert "refresh_origin_network_mismatch" not in _queued_event_types(background_tasks)


@pytest.mark.asyncio
async def test_refresh_from_a_different_network_revokes_that_session(
    refreshing_user: MagicMock,
) -> None:
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)
    await _establish_session(redis, refreshing_user, "desktop", HOME)
    background_tasks = BackgroundTasks()

    with pytest.raises(HTTPException) as raised:
        await _refresh(redis, refresh_token, OTHER_NETWORK, background_tasks)

    # The ordinary "refresh failed, authenticate again" answer: the response
    # must not tell a caller why the refresh was refused.
    assert raised.value.status_code == 403
    assert raised.value.detail == {"status": False, "message": "Refresh token invalid"}

    refresh_members = await get_valid_tokens(  # type: ignore[arg-type]
        redis, refreshing_user.id, TokenType.REFRESH
    )
    access_members = await get_valid_tokens(  # type: ignore[arg-type]
        redis, refreshing_user.id, TokenType.ACCESS
    )
    assert token_is_allowlisted(refresh_members, refresh_token) is False
    assert token_is_allowlisted(access_members, "access.one") is False
    # The user's other sessions survive.
    assert token_is_allowlisted(refresh_members, "refresh.desktop") is True
    assert token_is_allowlisted(access_members, "access.desktop") is True


@pytest.mark.asyncio
async def test_origin_anomaly_emits_a_distinguishable_security_event(
    refreshing_user: MagicMock,
) -> None:
    """The event must be separable from ordinary refresh failures so the
    anomaly rate can be measured."""
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)
    background_tasks = BackgroundTasks()

    with pytest.raises(HTTPException):
        await _refresh(redis, refresh_token, OTHER_NETWORK, background_tasks)

    event_types = _queued_event_types(background_tasks)
    assert "refresh_origin_network_mismatch" in event_types
    assert "refresh_token_invalid" not in event_types


@pytest.mark.asyncio
async def test_origin_anomaly_is_logged_where_it_can_actually_be_counted(
    refreshing_user: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    """The queued audit event is not observable today -- a background task added
    before a raise never runs, and the audit sink behind it is still a stub. The
    anomaly rate has to be countable somewhere, so the handler also logs."""
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)

    with caplog.at_level(logging.WARNING, logger="fastapi_rbac"):
        with pytest.raises(HTTPException):
            await _refresh(redis, refresh_token, OTHER_NETWORK, BackgroundTasks())

    assert any("refresh_origin_network_mismatch" in record.getMessage() for record in caplog.records)


@pytest.mark.asyncio
async def test_an_ordinary_refresh_logs_no_anomaly(
    refreshing_user: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)

    with caplog.at_level(logging.WARNING, logger="fastapi_rbac"):
        await _refresh(redis, refresh_token, SAME_NETWORK, BackgroundTasks())

    assert not any("refresh_origin_network_mismatch" in record.getMessage() for record in caplog.records)


@pytest.mark.asyncio
async def test_refresh_of_a_session_with_no_recorded_origin_succeeds(
    refreshing_user: MagicMock,
) -> None:
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user)
    background_tasks = BackgroundTasks()

    response = await _refresh(redis, refresh_token, OTHER_NETWORK, background_tasks)

    assert response.data.access_token  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_disabled_setting_lets_a_cross_network_refresh_through(
    refreshing_user: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "VALIDATE_TOKEN_IP", False)
    redis = MockRedisClient()
    refresh_token = await _seed_refresh_session(redis, refreshing_user, HOME)
    background_tasks = BackgroundTasks()

    response = await _refresh(redis, refresh_token, OTHER_NETWORK, background_tasks)

    assert response.data.access_token  # type: ignore[attr-defined]


# --- The access path ---------------------------------------------------------


@pytest.mark.asyncio
async def test_access_token_is_never_rejected_on_origin_grounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The comparison happens at refresh only (ADR 0011 decision 5)."""
    from app.api.deps import get_current_user

    redis = MockRedisClient()
    user = _user()
    access_token = security.create_access_token(str(user.id), user.email)
    await add_session_tokens_to_redis(
        redis,  # type: ignore[arg-type]
        user,
        access_token=access_token,
        refresh_token="refresh.one",
        access_expire_minutes=15,
        refresh_expire_minutes=60,
        origin_ip=HOME,
    )
    monkeypatch.setattr(
        "app.crud.user.get_with_roles_permissions",
        AsyncMock(return_value=_db_user(user.id)),
    )

    resolved = await get_current_user()(
        access_token=access_token,
        redis_client=redis,  # type: ignore[arg-type]
        db_session=MagicMock(),
    )

    assert resolved.id == user.id
