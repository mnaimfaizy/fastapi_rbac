"""Security events persist as AuditLog rows on both success and failure (#243).

A task queued on FastAPI BackgroundTasks never runs if the endpoint then
raises HTTPException. These tests hit the login endpoint and read the row,
so they cannot pass by asserting that a task was queued.

In ``test/api/`` because they boot the app in-process: see
[ADR 0012](../../../docs/adr/0012-test-suites-split-by-environment.md).
"""

from test.utils import get_csrf_token
from typing import Any

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog

PASSWORD = "TestPassw0rd!47"
UNKNOWN_EMAIL = "no-such-login@example.com"


def auth_url(path: str) -> str:
    return f"{settings.API_V1_STR}/auth{path}"


async def post_login(client: AsyncClient, email: str, password: str) -> int:
    _, headers = await get_csrf_token(client)
    response = await client.post(
        auth_url("/login"),
        json={"email": email, "password": password},
        headers=headers,
    )
    return response.status_code


async def events_named(db: AsyncSession, action: str) -> list[AuditLog]:
    result = await db.exec(select(AuditLog).where(AuditLog.action == action))
    return list(result.all())


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
