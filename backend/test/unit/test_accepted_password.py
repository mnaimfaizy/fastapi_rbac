"""User creation takes only a password that passed the policy (#272).

``crud.user.create`` and ``create_with_role`` accept an ``AcceptedPassword``
from ``password_policy.accept_initial_password`` and nothing else, so a
creation path that skips the policy fails instead of hashing whatever it was
handed. mypy catches a plaintext argument; these tests cover the runtime half
and every path that creates a user.
"""

from test.utils import STRONG_TEST_PASSWORD, accepted_password, random_email
from typing import Any

import pytest
from fastapi import BackgroundTasks
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import PasswordValidator
from app.crud.user_crud import user_crud
from app.db import init_db as init_db_module
from app.models.user_model import User
from app.schemas.user_schema import IUserCreateFields, UserRegister
from app.utils.accepted_password import AcceptedPassword
from app.utils.account_email_dispatch import dispatch_account_email


async def _user_count(db: AsyncSession, email: str) -> int:
    result = await db.exec(select(User).where(User.email == email))
    return len(list(result.all()))


# --------------------------------------------------------------------------
# The type
# --------------------------------------------------------------------------


def test_cannot_be_constructed_outside_the_policy() -> None:
    with pytest.raises(TypeError, match="issued only by password_policy"):
        AcceptedPassword(_mint=object(), password_hash="x", email="a@example.com")


async def test_repr_does_not_show_the_hash(db: AsyncSession) -> None:
    accepted = await accepted_password(db, email="repr@example.com")

    assert accepted.hash not in repr(accepted)
    assert repr(accepted) == "AcceptedPassword(<redacted>)"


async def test_email_binding_ignores_case(db: AsyncSession) -> None:
    accepted = await accepted_password(db, email="Mixed.Case@Example.com")

    assert accepted.is_for("mixed.case@example.com")
    assert not accepted.is_for("someone.else@example.com")


# --------------------------------------------------------------------------
# CRUD refuses anything else
# --------------------------------------------------------------------------


@pytest.mark.parametrize("method", ["create", "create_with_role"])
async def test_crud_refuses_a_plaintext_password(db: AsyncSession, method: str) -> None:
    email = random_email()
    create = getattr(user_crud, method)

    with pytest.raises(TypeError, match="AcceptedPassword"):
        await create(obj_in=IUserCreateFields(email=email), password=STRONG_TEST_PASSWORD, db_session=db)

    assert await _user_count(db, email) == 0


@pytest.mark.parametrize("method", ["create", "create_with_role"])
async def test_crud_refuses_a_password_accepted_for_another_address(db: AsyncSession, method: str) -> None:
    email = random_email()
    other = await accepted_password(db, email=random_email())
    create = getattr(user_crud, method)

    with pytest.raises(ValueError, match="different email address"):
        await create(obj_in=IUserCreateFields(email=email), password=other, db_session=db)

    assert await _user_count(db, email) == 0


async def test_crud_create_refuses_a_user_instance(db: AsyncSession) -> None:
    # A User would carry whatever hash its caller set on it.
    email = random_email()
    accepted = await accepted_password(db, email=email)
    smuggled: Any = User(email=email, password=PasswordValidator.get_password_hash("weak"))

    with pytest.raises(TypeError, match="IUserCreateFields"):
        await user_crud.create(obj_in=smuggled, password=accepted, db_session=db)

    assert await _user_count(db, email) == 0


async def test_crud_stores_the_accepted_hash(db: AsyncSession) -> None:
    email = random_email()
    accepted = await accepted_password(db, email=email)

    user = await user_crud.create(obj_in=IUserCreateFields(email=email), password=accepted, db_session=db)

    assert user.password == accepted.hash
    assert PasswordValidator.verify_password(STRONG_TEST_PASSWORD, user.password)


# --------------------------------------------------------------------------
# Registration's create branch fails closed
# --------------------------------------------------------------------------


async def test_registration_create_branch_requires_the_accepted_password(
    db: AsyncSession, redis_mock: Any
) -> None:
    email = random_email()

    with pytest.raises(ValueError, match="accepted_password is required"):
        await dispatch_account_email(
            email=email,
            db_session=db,
            redis_client=redis_mock,
            background_tasks=BackgroundTasks(),
            ip_address="203.0.113.9",
            may_create=True,
            registration=UserRegister(email=email, password=STRONG_TEST_PASSWORD),
        )

    assert await _user_count(db, email) == 0


# --------------------------------------------------------------------------
# Seeding goes through the policy
# --------------------------------------------------------------------------


async def test_seed_refuses_a_weak_superuser_password(db: AsyncSession, monkeypatch: Any) -> None:
    monkeypatch.setattr(settings, "FIRST_SUPERUSER_PASSWORD", "admin123")

    with pytest.raises(RuntimeError, match="FIRST_SUPERUSER_PASSWORD does not meet the password policy"):
        await init_db_module._accept_seed_password("seed@example.com", db_session=db)


async def test_seed_accepts_a_compliant_superuser_password(db: AsyncSession) -> None:
    accepted = await init_db_module._accept_seed_password("seed@example.com", db_session=db)

    assert accepted.is_for("seed@example.com")
    assert PasswordValidator.verify_password(settings.FIRST_SUPERUSER_PASSWORD, accepted.hash)


async def test_seeded_superuser_can_use_the_configured_password(db: AsyncSession) -> None:
    # The db fixture runs init_db, so the superuser was created through the policy.
    superuser = await user_crud.get_by_email(email=settings.FIRST_SUPERUSER_EMAIL, db_session=db)

    assert superuser is not None
    assert PasswordValidator.verify_password(settings.FIRST_SUPERUSER_PASSWORD, superuser.password)
