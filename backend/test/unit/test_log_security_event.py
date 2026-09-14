"""``log_security_event`` persists an AuditLog row in-process (#243).

Seam: ``app.utils.background_tasks.log_security_event``. Callers await it
on both success and raising paths; this module is the write, not a queue
into Celery or FastAPI BackgroundTasks.
"""

from datetime import datetime
from test.utils import random_email, random_lower_string
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import BackgroundTasks
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import ModeEnum, settings
from app.models.audit_log_model import AuditLog
from app.models.user_model import User
from app.utils import background_tasks as background_tasks_module
from app.utils.background_tasks import log_security_event
from app.worker import log_security_event_task


async def _create_user(db: AsyncSession) -> User:
    user = User(
        email=random_email(),
        password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _events(db: AsyncSession, action: str) -> list[AuditLog]:
    result = await db.exec(select(AuditLog).where(AuditLog.action == action))
    return list(result.all())


@pytest.mark.asyncio
async def test_log_security_event_writes_an_audit_row_for_a_known_user(
    db: AsyncSession,
) -> None:
    """A success-shaped event is retrievable as an AuditLog row, not a queued task."""
    user = await _create_user(db)
    background_tasks = BackgroundTasks()
    details = {"email": user.email, "ip_address": "192.0.2.10"}

    await log_security_event(
        background_tasks,
        event_type="successful_login",
        user_id=user.id,
        details=details,
        db_session=db,
    )

    rows = await _events(db, "successful_login")
    assert len(rows) == 1
    row = rows[0]
    assert row.actor_id == user.id
    assert row.action == "successful_login"
    assert row.resource_type == "security_event"
    assert row.resource_id == str(user.id)
    assert row.details == details
    assert isinstance(row.timestamp, datetime)
    assert background_tasks.tasks == []


@pytest.mark.asyncio
async def test_anonymous_security_event_persists_with_null_actor_id(
    db: AsyncSession,
) -> None:
    """Unknown-email login and similar events have no actor; null, not a sentinel."""
    background_tasks = BackgroundTasks()
    details = {"email": "nobody@example.com", "reason": "user_not_found"}

    await log_security_event(
        background_tasks,
        event_type="failed_login",
        user_id=None,
        details=details,
        db_session=db,
    )

    rows = await _events(db, "failed_login")
    assert len(rows) == 1
    row = rows[0]
    assert row.actor_id is None
    assert row.resource_type == "security_event"
    assert row.resource_id == ""
    assert row.details == details
    assert background_tasks.tasks == []


@pytest.mark.asyncio
async def test_failed_audit_write_does_not_raise(caplog: pytest.LogCaptureFixture) -> None:
    """An AuditLog outage must not turn the original 400 into a 500."""

    class BoomSession:
        def add(self, _obj: Any) -> None:
            raise RuntimeError("audit log is down")

        async def commit(self) -> None:
            raise AssertionError("commit should not run after add failed")

        async def rollback(self) -> None:
            return None

        async def refresh(self, _obj: Any) -> None:
            return None

    with caplog.at_level("ERROR", logger="fastapi_rbac"):
        await log_security_event(
            BackgroundTasks(),
            event_type="failed_login",
            user_id=None,
            details={"reason": "user_not_found"},
            db_session=BoomSession(),  # type: ignore[arg-type]
        )

    assert any("Failed to persist security event failed_login" in rec.getMessage() for rec in caplog.records)


def test_audit_log_actor_id_is_nullable_and_has_no_user_fk() -> None:
    """#238 dropped the User FK; #243 makes the column optional for anonymous events."""
    column = AuditLog.__table__.c["actor_id"]
    assert column.nullable is True
    assert list(column.foreign_keys) == []


@pytest.mark.asyncio
async def test_log_security_event_does_not_dispatch_celery(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Production used to delay() an empty Celery task; there is one in-process writer."""
    delay = MagicMock()
    monkeypatch.setattr(background_tasks_module, "CELERY_AVAILABLE", True)
    monkeypatch.setattr(settings, "MODE", ModeEnum.production)
    monkeypatch.setattr(log_security_event_task, "delay", delay)

    await log_security_event(
        BackgroundTasks(),
        event_type="failed_login",
        user_id=None,
        details={"reason": "user_not_found"},
        db_session=db,
    )

    delay.assert_not_called()
    rows = await _events(db, "failed_login")
    assert len(rows) == 1
    assert rows[0].actor_id is None


@pytest.mark.asyncio
async def test_log_security_event_opens_a_session_when_none_is_passed(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Callers that cannot thread the request session still persist a row."""

    class SessionCM:
        async def __aenter__(self) -> AsyncSession:
            return db

        async def __aexit__(self, *_args: object) -> bool:
            return False

    monkeypatch.setattr("app.db.session.SessionLocal", lambda: SessionCM())

    await log_security_event(
        BackgroundTasks(),
        event_type="failed_login",
        user_id=None,
        details={"reason": "user_not_found"},
        db_session=None,
    )

    rows = await _events(db, "failed_login")
    assert len(rows) == 1
    assert rows[0].actor_id is None


@pytest.mark.asyncio
async def test_failed_rollback_after_audit_write_is_logged(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A broken session must not turn the original request into a 500."""

    class BoomSession:
        def add(self, _obj: Any) -> None:
            raise RuntimeError("audit log is down")

        async def rollback(self) -> None:
            raise RuntimeError("rollback failed")

    with caplog.at_level("ERROR", logger="fastapi_rbac"):
        await log_security_event(
            BackgroundTasks(),
            event_type="failed_login",
            user_id=None,
            details={"reason": "user_not_found"},
            db_session=BoomSession(),  # type: ignore[arg-type]
        )

    messages = [rec.getMessage() for rec in caplog.records]
    assert any("Failed to persist security event failed_login" in message for message in messages)
    assert any("Failed to roll back session after audit write failure" in message for message in messages)
