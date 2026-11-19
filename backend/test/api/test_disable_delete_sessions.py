"""Disable and delete end every session and emailed link (#281).

The allowlist is the only revocation mechanism (ADR 0011 decision 1). These
tests are what shows that: a user who is disabled and then re-enabled is
active again, and the access token and refresh cookie they held are still
refused. Setting ``is_active`` false on the row is not what ends them.

In ``test/api/`` because these boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from test.utils import STRONG_TEST_PASSWORD, get_csrf_token, random_strong_password
from typing import Any, Dict, Tuple
from uuid import UUID

import pytest
from httpx import AsyncClient, Response
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.schemas.common_schema import TokenType
from app.utils import emailed_links, sessions
from app.utils.account_disable import end_access_for_inactive_users
from app.utils.allowlist import get_valid_tokens
from app.utils.emailed_links import LinkKind
from app.utils.sessions import SessionRejected

PASSWORD = STRONG_TEST_PASSWORD


@pytest.fixture(autouse=True)
def _no_response_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)


def users_url(path: str) -> str:
    return f"{settings.API_V1_STR}/users{path}"


async def login(client: AsyncClient, email: str, password: str = PASSWORD) -> Tuple[str, Dict[str, str]]:
    """Return the issued access token and headers carrying it plus CSRF."""
    _, headers = await get_csrf_token(client)
    response = await client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": email, "password": password},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    token = str(response.json()["data"]["access_token"])
    return token, {**headers, "Authorization": f"Bearer {token}"}


async def accepted(redis_mock: Any, access_token: str) -> bool:
    try:
        await sessions.accepts(access_token, redis_client=redis_mock)
    except SessionRejected:
        return False
    return True


async def allowlist_count(redis_mock: Any, user_id: UUID) -> int:
    total = 0
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        total += len(await get_valid_tokens(redis_mock, user_id, token_type))
    return total


async def link_is_live(redis_mock: Any, kind: LinkKind, user_id: UUID) -> bool:
    """The stored form from ``emailed_links``: ``emailed_link:{kind}:{user_id}``."""
    stored = await redis_mock.get(f"emailed_link:{kind.value}:{user_id}")
    return stored is not None


async def events_named(db: AsyncSession, action: str) -> list[AuditLog]:
    result = await db.exec(select(AuditLog).where(AuditLog.action == action))
    return list(result.all())


async def put_active(
    client: AsyncClient, headers: Dict[str, str], user_id: UUID, is_active: bool
) -> Response:
    return await client.put(users_url(f"/{user_id}"), json={"is_active": is_active}, headers=headers)


async def test_reenable_refuses_the_old_access_token_and_refresh_cookie(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    """Log in, disable, re-enable. The old access token and refresh cookie are refused.

    The user is active again, so the refusal is the allowlist, not an
    ``is_active`` check. This fails on a tree where disable leaves sessions
    in place.
    """
    user = await user_factory.create(email="reenable-target@example.com", password=PASSWORD, verified=True)
    await user_factory.create(
        email="reenable-admin@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    old_access, _ = await login(client, user.email)
    old_refresh = client.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
    assert old_refresh
    _, admin_headers = await login(client, "reenable-admin@example.com")

    disabled = await put_active(client, admin_headers, user.id, False)
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["data"]["is_active"] is False

    reenabled = await put_active(client, admin_headers, user.id, True)
    assert reenabled.status_code == 200, reenabled.text
    assert reenabled.json()["data"]["is_active"] is True
    await db.refresh(user)
    assert user.is_active is True

    me = await client.get(users_url("/me"), headers={"Authorization": f"Bearer {old_access}"})
    assert me.status_code == 403, me.text
    assert await accepted(redis_mock, old_access) is False

    _, csrf = await get_csrf_token(client)
    client.cookies.set(settings.REFRESH_TOKEN_COOKIE_NAME, old_refresh)
    refreshed = await client.post(f"{settings.API_V1_STR}/auth/new_access_token", headers=csrf)
    assert refreshed.status_code == 403, refreshed.text
    assert refreshed.json()["detail"]["message"] == "Refresh token invalid"


async def test_put_disable_ends_sessions_and_reset_links_before_the_response(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    """``PUT /users/{id}`` with ``is_active=false`` ends sessions and links before it returns.

    The acting administrator's own session still works.
    """
    user = await user_factory.create(email="disable-target@example.com", password=PASSWORD, verified=True)
    admin = await user_factory.create(
        email="disable-admin@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    access, _ = await login(client, user.email)
    other = await sessions.open(user, "198.51.100.20", redis_client=redis_mock)
    reset_token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    await emailed_links.issue(LinkKind.VERIFICATION, user, redis=redis_mock)
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, user.id)
    assert await link_is_live(redis_mock, LinkKind.VERIFICATION, user.id)
    assert await allowlist_count(redis_mock, user.id) > 0
    admin_access, admin_headers = await login(client, admin.email)

    response = await put_active(client, admin_headers, user.id, False)

    assert response.status_code == 200, response.text
    assert await accepted(redis_mock, access) is False
    assert await accepted(redis_mock, other.access_token) is False
    assert await allowlist_count(redis_mock, user.id) == 0
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, user.id) is False
    assert await link_is_live(redis_mock, LinkKind.VERIFICATION, user.id) is False
    assert await accepted(redis_mock, admin_access) is True
    me = await client.get(users_url("/me"), headers=admin_headers)
    assert me.status_code == 200, me.text

    # The link is gone, not merely blocked by the inactive flag: re-enable and
    # the same token is still refused.
    reenabled = await put_active(client, admin_headers, user.id, True)
    assert reenabled.status_code == 200, reenabled.text
    _, csrf = await get_csrf_token(client)
    redeemed = await client.post(
        f"{settings.API_V1_STR}/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": random_strong_password()},
        headers=csrf,
    )
    assert redeemed.status_code == 400, redeemed.text


async def test_bulk_disable_ends_sessions_and_reset_links_for_two_users(
    client: AsyncClient, user_factory: Any, redis_mock: Any
) -> None:
    """``PUT /users/bulk-update`` does the same for two users, and the admin session survives."""
    first = await user_factory.create(email="bulk-one@example.com", password=PASSWORD, verified=True)
    second = await user_factory.create(email="bulk-two@example.com", password=PASSWORD, verified=True)
    admin = await user_factory.create(
        email="bulk-admin@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    first_access, _ = await login(client, first.email)
    second_session = await sessions.open(second, "198.51.100.21", redis_client=redis_mock)
    await emailed_links.issue(LinkKind.PASSWORD_RESET, first, redis=redis_mock)
    await emailed_links.issue(LinkKind.PASSWORD_RESET, second, redis=redis_mock)
    admin_access, admin_headers = await login(client, admin.email)

    response = await client.put(
        users_url("/bulk-update"),
        json={"user_ids": [str(first.id), str(second.id)], "updates": {"is_active": False}},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    assert await accepted(redis_mock, first_access) is False
    assert await accepted(redis_mock, second_session.access_token) is False
    assert await allowlist_count(redis_mock, first.id) == 0
    assert await allowlist_count(redis_mock, second.id) == 0
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, first.id) is False
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, second.id) is False
    assert await accepted(redis_mock, admin_access) is True
    me = await client.get(users_url("/me"), headers=admin_headers)
    assert me.status_code == 200, me.text


async def test_delete_leaves_no_allowlist_entries_or_emailed_links(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    """``DELETE /users/{id}`` leaves no allowlist entries and no live emailed link.

    Verification and reset links are ``emailed_link:{kind}:{user_id}``. There
    is no ``verification_token:{id}`` key in this tree.
    """
    user = await user_factory.create(email="delete-target@example.com", password=PASSWORD, verified=True)
    admin = await user_factory.create(
        email="delete-admin@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    access, _ = await login(client, user.email)
    await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    await emailed_links.issue(LinkKind.VERIFICATION, user, redis=redis_mock)
    assert await link_is_live(redis_mock, LinkKind.VERIFICATION, user.id)
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, user.id)
    user_id = user.id
    _, admin_headers = await login(client, admin.email)

    response = await client.delete(users_url(f"/{user_id}"), headers=admin_headers)

    assert response.status_code == 200, response.text
    assert await accepted(redis_mock, access) is False
    assert await allowlist_count(redis_mock, user_id) == 0
    assert await link_is_live(redis_mock, LinkKind.VERIFICATION, user_id) is False
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, user_id) is False
    named_by_the_issue = await redis_mock.get(f"verification_token:{user_id}")
    assert named_by_the_issue is None

    disabled = await events_named(db, "user_disabled")
    deleted = await events_named(db, "user_deleted")
    assert disabled == []
    assert len(deleted) == 1
    assert deleted[0].actor_id == admin.id
    assert deleted[0].details["subject_user_id"] == str(user_id)


async def test_a_caller_cannot_disable_themselves(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    admin = await user_factory.create(
        email="self-disable@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    access, headers = await login(client, admin.email)

    response = await put_active(client, headers, admin.id, False)

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Users cannot disable themselves."
    await db.refresh(admin)
    assert admin.is_active is True
    assert await accepted(redis_mock, access) is True
    me = await client.get(users_url("/me"), headers=headers)
    assert me.status_code == 200, me.text


async def test_bulk_disable_refuses_when_the_caller_is_included(
    client: AsyncClient, db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    admin = await user_factory.create(
        email="bulk-self@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    other = await user_factory.create(email="bulk-other@example.com", password=PASSWORD, verified=True)
    other_session = await sessions.open(other, "198.51.100.22", redis_client=redis_mock)
    _, headers = await login(client, admin.email)

    response = await client.put(
        users_url("/bulk-update"),
        json={"user_ids": [str(admin.id), str(other.id)], "updates": {"is_active": False}},
        headers=headers,
    )

    assert response.status_code == 403, response.text
    await db.refresh(admin)
    await db.refresh(other)
    assert admin.is_active is True
    assert other.is_active is True
    assert await accepted(redis_mock, other_session.access_token) is True


async def test_startup_cleanup_ends_sessions_of_users_already_inactive(
    db: AsyncSession, user_factory: Any, redis_mock: Any
) -> None:
    """A process start ends access for users who are already inactive, and leaves active users alone."""
    inactive = await user_factory.create(verified=True, is_active=True)
    active = await user_factory.create(verified=True, is_active=True)
    planted = await sessions.open(inactive, "198.51.100.30", redis_client=redis_mock)
    active_session = await sessions.open(active, "198.51.100.31", redis_client=redis_mock)
    await emailed_links.issue(LinkKind.PASSWORD_RESET, inactive, redis=redis_mock)
    await emailed_links.issue(LinkKind.VERIFICATION, inactive, redis=redis_mock)
    inactive.is_active = False
    db.add(inactive)
    await db.commit()

    ended = await end_access_for_inactive_users(db, redis_mock)

    assert ended >= 1
    assert await accepted(redis_mock, planted.access_token) is False
    assert await allowlist_count(redis_mock, inactive.id) == 0
    assert await link_is_live(redis_mock, LinkKind.PASSWORD_RESET, inactive.id) is False
    assert await link_is_live(redis_mock, LinkKind.VERIFICATION, inactive.id) is False
    assert await accepted(redis_mock, active_session.access_token) is True
    await db.refresh(inactive)
    assert inactive.is_active is False


async def test_disable_records_one_audit_row_by_the_administrator(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(email="audit-target@example.com", password=PASSWORD, verified=True)
    admin = await user_factory.create(
        email="audit-admin@example.com", password=PASSWORD, verified=True, is_superuser=True
    )
    _, admin_headers = await login(client, admin.email)

    response = await put_active(client, admin_headers, user.id, False)

    assert response.status_code == 200, response.text
    rows = await events_named(db, "user_disabled")
    assert len(rows) == 1
    assert rows[0].actor_id == admin.id
    assert rows[0].details["subject_user_id"] == str(user.id)
    assert rows[0].resource_type == "security_event"
