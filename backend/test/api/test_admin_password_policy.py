"""Admin-set passwords are subject to the same policy as self-service (#198).

``enforce_password_complexity`` had four callers, all in ``auth.py``. An
administrator could set a password every self-service path then refused, and
the user was stuck: they could not change it to the value they were given.

What is under test is the agreement, not one endpoint's spelling of it: a
password the validator rejects must be rejected on admin create and admin
update too, with the same ``{message, errors}`` detail the self-service paths
return. Bulk update refuses a ``password`` key outright -- applying one
password to many users is the wrong operation even when the value is strong.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.api.v1.endpoints.user import bulk_update_users, create_user, update_user
from app.core.security import PasswordValidator
from app.models.user_model import User
from app.schemas.user_schema import IUserCreate, IUserUpdate
from app.utils.password_policy import PASSWORD_COMPLEXITY_FAILURE_MESSAGE

# The three named in #192. Each fails a different rule: too common and too
# short, sequential characters, and length alone.
REJECTED_PASSWORDS = ["password", "NewPassword123!", "Short1!"]

# Satisfies every rule in settings. Shared with the self-service policy tests.
ACCEPTED_PASSWORD = "QaRegisterPass!47"


def _admin() -> User:
    return User(id=uuid4(), email="admin@example.com", first_name="An", last_name="Admin")


def _create_payload(password: str, email: str | None = None) -> IUserCreate:
    return IUserCreate(
        email=email or f"admin-made-{uuid4().hex[:8]}@example.com",
        password=password,
        first_name="Admin",
        last_name="Made",
        role_id=[],
    )


def _complexity_detail(password: str) -> dict[str, Any]:
    _, errors = PasswordValidator.validate_complexity(password)
    return {"message": PASSWORD_COMPLEXITY_FAILURE_MESSAGE, "errors": errors}


# --------------------------------------------------------------------------
# Admin create applies the policy
# --------------------------------------------------------------------------


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_admin_create_rejects_a_password_the_policy_rejects(
    db: AsyncSession, redis_mock: MockRedisClient, password: str
) -> None:
    with pytest.raises(HTTPException) as raised:
        await create_user(
            background_tasks=BackgroundTasks(),
            new_user=_create_payload(password),
            db_session=db,
            redis_client=redis_mock,
            current_user=_admin(),
        )

    assert raised.value.status_code == 400
    assert raised.value.detail == _complexity_detail(password)


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_admin_create_creates_no_user(
    db: AsyncSession, redis_mock: MockRedisClient, password: str
) -> None:
    email = f"no-row-{uuid4().hex[:8]}@example.com"

    with pytest.raises(HTTPException) as raised:
        await create_user(
            background_tasks=BackgroundTasks(),
            new_user=_create_payload(password, email=email),
            db_session=db,
            redis_client=redis_mock,
            current_user=_admin(),
        )

    assert raised.value.status_code == 400
    db.expunge_all()
    assert await crud.user.get_by_email(db_session=db, email=email) is None


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_admin_create_logs_its_own_security_event(
    db: AsyncSession, redis_mock: MockRedisClient, monkeypatch: pytest.MonkeyPatch, password: str
) -> None:
    recorded = AsyncMock()
    monkeypatch.setattr("app.utils.password_policy.log_security_event", recorded)

    with pytest.raises(HTTPException):
        await create_user(
            background_tasks=BackgroundTasks(),
            new_user=_create_payload(password),
            db_session=db,
            redis_client=redis_mock,
            current_user=_admin(),
        )

    recorded.assert_awaited_once()
    assert recorded.await_args.kwargs["event_type"] == "admin_user_create_password_complexity_failed"
    assert recorded.await_args.kwargs["details"]["errors"]


# --------------------------------------------------------------------------
# Admin update applies the policy
# --------------------------------------------------------------------------


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_admin_update_rejects_a_password_the_policy_rejects(
    db: AsyncSession, user_factory: Any, password: str
) -> None:
    user = await user_factory.create(password=ACCEPTED_PASSWORD)

    with pytest.raises(HTTPException) as raised:
        await update_user(
            user_update=IUserUpdate(password=password),
            user=user,
            db_session=db,
            current_user=_admin(),
            background_tasks=BackgroundTasks(),
        )

    assert raised.value.status_code == 400
    assert raised.value.detail == _complexity_detail(password)


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_admin_update_leaves_the_password_unchanged(
    db: AsyncSession, user_factory: Any, password: str
) -> None:
    user = await user_factory.create(password=ACCEPTED_PASSWORD)
    original_hash = user.password

    with pytest.raises(HTTPException) as raised:
        await update_user(
            user_update=IUserUpdate(password=password),
            user=user,
            db_session=db,
            current_user=_admin(),
            background_tasks=BackgroundTasks(),
        )

    assert raised.value.status_code == 400
    db.expunge_all()
    reloaded = await crud.user.get(id=user.id, db_session=db)
    assert reloaded is not None
    assert reloaded.password == original_hash


@pytest.mark.parametrize("password", REJECTED_PASSWORDS)
async def test_rejected_admin_update_logs_its_own_security_event(
    db: AsyncSession, user_factory: Any, monkeypatch: pytest.MonkeyPatch, password: str
) -> None:
    user = await user_factory.create(password=ACCEPTED_PASSWORD)
    recorded = AsyncMock()
    monkeypatch.setattr("app.utils.password_policy.log_security_event", recorded)

    with pytest.raises(HTTPException):
        await update_user(
            user_update=IUserUpdate(password=password),
            user=user,
            db_session=db,
            current_user=_admin(),
            background_tasks=BackgroundTasks(),
        )

    recorded.assert_awaited_once()
    assert recorded.await_args.kwargs["event_type"] == "admin_user_update_password_complexity_failed"
    assert recorded.await_args.kwargs["details"]["errors"]


# --------------------------------------------------------------------------
# Bulk update refuses a password key rather than applying one
# --------------------------------------------------------------------------


async def test_bulk_update_rejects_a_password_key(db: AsyncSession, user_factory: Any) -> None:
    """One password for many users is refused, even when the value is strong."""
    user = await user_factory.create(password=ACCEPTED_PASSWORD)

    with pytest.raises(HTTPException) as raised:
        await bulk_update_users(
            bulk_update={
                "user_ids": [user.id],
                "updates": {"password": ACCEPTED_PASSWORD, "first_name": "Changed"},
            },
            db_session=db,
            current_user=_admin(),
        )

    assert raised.value.status_code == 400
    assert "password" in str(raised.value.detail).lower()
    db.expunge_all()
    reloaded = await crud.user.get(id=user.id, db_session=db)
    assert reloaded is not None
    assert reloaded.first_name != "Changed"
