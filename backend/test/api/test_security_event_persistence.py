"""Security events persist as AuditLog rows on both success and failure (#243).

A task queued on FastAPI BackgroundTasks never runs if the endpoint then
raises HTTPException. These tests hit the endpoints and read the row, so
they cannot pass by asserting that a task was queued.

In ``test/api/`` because they boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from test.utils import get_csrf_token, random_email
from typing import Any, Dict, Optional

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.utils.account_email_dispatch import ACCOUNT_EMAIL_UNIFORM_MESSAGE

PASSWORD = "TestPassw0rd!47"
UNKNOWN_EMAIL = "no-such-login@example.com"
WRONG_PASSWORD = "incorrect"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def csrf_headers(client: AsyncClient) -> Dict[str, str]:
    _, headers = await get_csrf_token(client)
    return headers


async def post_login(client: AsyncClient, email: str, password: str) -> int:
    response = await client.post(
        auth_url("/login"),
        json={"email": email, "password": password},
        headers=await csrf_headers(client),
    )
    return response.status_code


async def events_named(db: AsyncSession, action: str) -> list[AuditLog]:
    result = await db.exec(select(AuditLog).where(AuditLog.action == action))
    return list(result.all())


def matching(rows: list[AuditLog], email: Optional[str] = None) -> list[AuditLog]:
    if email is None:
        return rows
    return [row for row in rows if row.details.get("email") == email]


async def test_failed_login_writes_an_audit_row(client: AsyncClient, db: AsyncSession) -> None:
    """A raising login path must leave a row, not a discarded background task."""
    status_code = await post_login(client, UNKNOWN_EMAIL, PASSWORD)

    assert status_code == 422
    rows = await events_named(db, "failed_login")
    assert len(rows) == 1
    row = rows[0]
    assert row.actor_id is None
    assert row.resource_type == "security_event"
    assert row.resource_id == ""
    assert row.details["reason"] == "user_not_found"
    assert row.details["email"] == UNKNOWN_EMAIL


async def test_successful_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)

    status_code = await post_login(client, user.email, PASSWORD)

    assert status_code == 200
    rows = await events_named(db, "successful_login")
    assert len(rows) == 1
    row = rows[0]
    assert row.actor_id == user.id
    assert row.resource_type == "security_event"
    assert row.resource_id == str(user.id)
    assert row.details["email"] == user.email


async def test_failed_audit_write_does_not_change_failed_login_status(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A 422 for a bad login stays 422 when the audit insert fails."""

    async def boom(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError("audit log is down")

    monkeypatch.setattr("app.utils.background_tasks._persist_security_event", boom)

    status_code = await post_login(client, UNKNOWN_EMAIL, PASSWORD)

    assert status_code == 422


async def test_unverified_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=False, is_active=True)

    status_code = await post_login(client, user.email, PASSWORD)

    assert status_code == 422
    rows = matching(await events_named(db, "unverified_login_attempt"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_inactive_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=False)

    status_code = await post_login(client, user.email, PASSWORD)

    assert status_code == 403
    rows = matching(await events_named(db, "inactive_user_login_attempt"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_locked_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create_locked(password=PASSWORD, verified=True)

    status_code = await post_login(client, user.email, PASSWORD)

    assert status_code == 422
    rows = matching(await events_named(db, "locked_account_attempt"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_wrong_password_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)

    status_code = await post_login(client, user.email, WRONG_PASSWORD)

    assert status_code == 422
    rows = matching(await events_named(db, "oauth2_failed_login"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_refresh_without_token_writes_an_audit_row(client: AsyncClient, db: AsyncSession) -> None:
    response = await client.post(auth_url("/new_access_token"), json={}, headers=await csrf_headers(client))

    assert response.status_code == 401
    rows = await events_named(db, "refresh_token_missing")
    assert len(rows) == 1
    assert rows[0].actor_id is None
    assert rows[0].resource_type == "security_event"


async def test_refresh_with_undecodable_token_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession
) -> None:
    response = await client.post(
        auth_url("/new_access_token"),
        json={"refresh_token": "not-a-jwt"},
        headers=await csrf_headers(client),
    )

    assert response.status_code in {400, 401, 403}
    rows = await events_named(db, "refresh_token_decode_error")
    assert len(rows) == 1
    assert rows[0].resource_type == "security_event"


async def test_oauth2_unknown_user_writes_an_audit_row(client: AsyncClient, db: AsyncSession) -> None:
    email = random_email()
    response = await client.post(
        auth_url("/access-token"),
        data={"username": email, "password": PASSWORD},
    )

    assert response.status_code == 422
    rows = matching(await events_named(db, "oauth2_failed_login"), email)
    assert len(rows) == 1
    assert rows[0].actor_id is None


async def test_oauth2_successful_login_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)

    response = await client.post(
        auth_url("/access-token"),
        data={"username": user.email, "password": PASSWORD},
    )

    assert response.status_code == 200
    rows = matching(await events_named(db, "oauth2_successful_login"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_oauth2_inactive_user_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=False)

    response = await client.post(
        auth_url("/access-token"),
        data={"username": user.email, "password": PASSWORD},
    )

    assert response.status_code == 400
    rows = matching(await events_named(db, "oauth2_inactive_user_attempt"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_password_change_with_wrong_current_password_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, user_factory: Any
) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)
    headers = await csrf_headers(client)
    login_response = await client.post(
        auth_url("/login"),
        json={"email": user.email, "password": PASSWORD},
        headers=headers,
    )
    assert login_response.status_code == 200
    token = login_response.json()["data"]["access_token"]
    headers["Authorization"] = f"Bearer {token}"

    response = await client.post(
        auth_url("/change_password"),
        json={"current_password": WRONG_PASSWORD, "new_password": "ReplacementPassword!42"},
        headers=headers,
    )

    assert response.status_code == 400
    rows = matching(await events_named(db, "password_change_invalid_current_password"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_logout_writes_an_audit_row(client: AsyncClient, db: AsyncSession, user_factory: Any) -> None:
    user = await user_factory.create(password=PASSWORD, verified=True, is_active=True)
    headers = await csrf_headers(client)
    login_response = await client.post(
        auth_url("/login"),
        json={"email": user.email, "password": PASSWORD},
        headers=headers,
    )
    assert login_response.status_code == 200
    token = login_response.json()["data"]["access_token"]
    headers["Authorization"] = f"Bearer {token}"

    response = await client.post(auth_url("/logout"), headers=headers)

    assert response.status_code == 200
    rows = matching(await events_named(db, "user_logout"), user.email)
    assert len(rows) == 1
    assert rows[0].actor_id == user.id


async def test_registration_password_too_long_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    response = await client.post(
        auth_url("/register"),
        json={
            "email": random_email(),
            "password": "x" * 1001,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=await csrf_headers(client),
    )

    assert response.status_code == 400
    rows = await events_named(db, "registration_password_too_long")
    assert len(rows) == 1
    assert rows[0].details["password_length"] == 1001


async def test_registration_blocked_domain_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_BLACKLIST", ["blocked.example.com"])
    email = "someone@blocked.example.com"
    response = await client.post(
        auth_url("/register"),
        json={
            "email": email,
            "password": PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=await csrf_headers(client),
    )

    assert response.status_code == 400
    rows = matching(await events_named(db, "registration_blocked_domain"), email)
    assert len(rows) == 1


async def test_user_registered_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    email = random_email()
    response = await client.post(
        auth_url("/register"),
        json={
            "email": email,
            "password": PASSWORD,
            "first_name": "Test",
            "last_name": "User",
        },
        headers=await csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["message"] == ACCOUNT_EMAIL_UNIFORM_MESSAGE
    rows = matching(await events_named(db, "user_registered"), email)
    assert len(rows) == 1
    assert rows[0].actor_id is not None


async def test_resend_to_absent_address_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    email = random_email()
    response = await client.post(
        auth_url("/resend-verification-email"),
        json={"email": email},
        headers=await csrf_headers(client),
    )

    assert response.status_code == 200
    rows = matching(await events_named(db, "account_email_absent_no_mail_sent"), email)
    assert len(rows) == 1
    assert rows[0].actor_id is None


async def test_account_email_budget_exhaustion_writes_an_audit_row(
    client: AsyncClient, db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "UNIFORM_ACCOUNT_RESPONSE_FLOOR_SECONDS", 0)
    email = random_email()
    headers = await csrf_headers(client)
    for _ in range(settings.MAX_ACCOUNT_EMAILS_PER_ADDRESS_PER_HOUR):
        charged = await client.post(
            auth_url("/resend-verification-email"),
            json={"email": email},
            headers=headers,
        )
        assert charged.status_code == 200

    response = await client.post(
        auth_url("/resend-verification-email"),
        json={"email": email},
        headers=headers,
    )

    assert response.status_code == 429
    rows = matching(await events_named(db, "account_email_budget_exhausted"), email)
    assert len(rows) == 1
    assert rows[0].actor_id is None
