"""A QA account repair revokes a pending reset link (#283).

This needs the database, so it lives in ``api/`` (ADR 0012). The rest of the
seeder stays in ``test/unit/test_qa_accounts.py``.
"""

import hashlib
from typing import Any

import pytest
from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.user_crud import user_crud
from app.models.role_model import Role
from app.models.user_model import User
from app.qa_accounts.accounts import ACCOUNTS, EMAIL_DOMAIN, select_accounts
from app.qa_accounts.seeding import seed
from app.utils import emailed_links
from app.utils.account_token_responses import INVALID_PASSWORD_RESET_TOKEN_MESSAGE
from app.utils.emailed_links import LinkKind


async def _roles(db: AsyncSession) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for name in ("Admin", "Manager", "User"):
        existing = (await db.exec(select(Role).where(Role.name == name))).first()
        if existing is None:
            existing = Role(name=name, description=f"{name} role")
            db.add(existing)
            await db.commit()
            await db.refresh(existing)
        roles[name] = existing
    return roles


async def _user(db: AsyncSession, account_id: str) -> User:
    user = await user_crud.get_by_email(email=f"{account_id}@{EMAIL_DOMAIN}", db_session=db)
    assert user is not None
    await db.refresh(user, attribute_names=["roles"])
    return user


async def test_a_repair_revokes_a_pending_reset_link(db: AsyncSession, redis_mock: Any) -> None:
    """A repair that does not change the password still kills a reset link issued while drifted."""
    roles = await _roles(db)
    await seed(ACCOUNTS, db, redis_mock)
    user = await _user(db, "user")
    token = await emailed_links.issue(LinkKind.PASSWORD_RESET, user, redis=redis_mock)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert digest in [str(value) for value in redis_mock._storage.values()]
    user.roles = [roles["Admin"]]
    db.add(user)
    await db.commit()

    await seed(select_accounts("user"), db, redis_mock)

    assert digest not in [str(value) for value in redis_mock._storage.values()]

    async def should_not_run(_user: User) -> None:
        raise AssertionError("a revoked reset link must not change the password")

    with pytest.raises(HTTPException) as exc_info:
        await emailed_links.redeem_password_reset(
            token, should_not_run, client_address=None, db_session=db, redis=redis_mock
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == INVALID_PASSWORD_RESET_TOKEN_MESSAGE
