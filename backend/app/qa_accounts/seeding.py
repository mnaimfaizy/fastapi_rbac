"""Create QA Accounts and repair their drift. Only ``__main__`` calls this, after the refusal check."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence

from redis.asyncio import Redis
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.security import PasswordValidator
from app.models.password_history_model import UserPasswordHistory
from app.models.role_model import Role
from app.models.user_model import User
from app.qa_accounts.accounts import QAAccount, QAAccountsError
from app.schemas.user_schema import IUserCreateFields
from app.utils.accepted_password import AcceptedPassword
from app.utils.password_policy import (
    FixturePasswordReason,
    InitialPasswordReason,
    accept_initial_password,
    restore_fixture_password,
)
from app.utils.token import revoke_all_user_tokens


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def _role(account: QAAccount, db_session: AsyncSession) -> Role:
    role = await crud.role.get_role_by_name(name=account.role, db_session=db_session)
    if role is None:
        raise QAAccountsError(
            f"role {account.role!r} does not exist; seed the roles first with python app/initial_data.py"
        )
    return role


async def _accept(account: QAAccount, db_session: AsyncSession) -> AcceptedPassword:
    """The fixture password, through the same policy as every first password (#272)."""
    return await accept_initial_password(
        account.password,
        reason=InitialPasswordReason.SEED,
        email=account.email,
        actor=None,
        db_session=db_session,
    )


async def _create(account: QAAccount, role: Role, db_session: AsyncSession) -> None:
    now = _now()
    fields = IUserCreateFields(
        first_name=account.first_name,
        last_name=account.last_name,
        email=account.email,
        is_active=True,
        is_superuser=False,
        verified=True,
        needs_to_change_password=False,
        last_changed_password_date=now,
        expiry_date=now,
        role_id=[role.id],
        roles=[],
    )
    await crud.user.create(obj_in=fields, password=await _accept(account, db_session), db_session=db_session)


def _repair_sign_in(user: User, role: Role, changes: list[str]) -> None:
    """Put back what stops this account signing in as its role. Records each fix in ``changes``."""
    if not user.verified:
        user.verified = True
        changes.append("marked verified")
    if not user.is_active:
        user.is_active = True
        changes.append("re-enabled")
    if user.is_locked or user.locked_until is not None:
        user.is_locked = False
        user.locked_until = None
        changes.append("unlocked")
    if user.number_of_failed_attempts:
        user.number_of_failed_attempts = 0
        changes.append("cleared failed sign-in attempts")
    if user.needs_to_change_password:
        user.needs_to_change_password = False
        changes.append("cleared the temporary-password flag")
    if user.is_superuser:
        user.is_superuser = False
        changes.append("removed superuser")
    if [r.id for r in user.roles] != [role.id]:
        current = sorted(r.name or str(r.id) for r in user.roles)
        user.roles = [role]
        changes.append(f"set roles to [{role.name}] (were [{', '.join(current)}])")


async def _restore_profile(
    account: QAAccount, user: User, db_session: AsyncSession, changes: list[str]
) -> None:
    """``--restore`` only: the rest of the account's default state, and what it deletes."""
    if (user.first_name, user.last_name) != (account.first_name, account.last_name):
        user.first_name, user.last_name = account.first_name, account.last_name
        changes.append("reset name")
    if user.contact_phone is not None:
        user.contact_phone = None
        changes.append("cleared contact phone")
    if user.verification_code is not None:
        user.verification_code = None
        changes.append("cleared verification code")
    deleted = await db_session.exec(
        delete(UserPasswordHistory).where(UserPasswordHistory.user_id == user.id)  # type: ignore[arg-type]
    )
    count = deleted.rowcount or 0
    if count:
        changes.append(f"deleted {count} password-history row{'s' if count != 1 else ''}")


async def seed_account(
    account: QAAccount, db_session: AsyncSession, redis_client: Redis, *, restore: bool = False
) -> list[str]:
    """Create ``account`` or repair its drift. Returns what changed; empty means nothing did.

    Any repair ends every session the account holds, so a token issued while
    it had drifted (another password, other roles, disabled) stops working.
    """
    role = await _role(account, db_session)
    user = await crud.user.get_by_email(email=account.email, db_session=db_session)
    if user is None:
        await _create(account, role, db_session)
        return ["created"]

    changes: list[str] = []
    if not user.password or not PasswordValidator.verify_password(account.password, user.password):
        # First, with nothing else staged on the session: a rules refusal
        # writes its audit event with a commit, which would otherwise save
        # half a repair without ending the sessions.
        await restore_fixture_password(
            user,
            account.password,
            reason=FixturePasswordReason.QA_ACCOUNT,
            db_session=db_session,
            redis_client=redis_client,
        )
        changes.append("reset password")
    committed = len(changes)
    _repair_sign_in(user, role, changes)
    if restore:
        # After the password, so the history row that adds is deleted too.
        await _restore_profile(account, user, db_session, changes)
    if len(changes) > committed:
        db_session.add(user)
        await revoke_all_user_tokens(redis_client, user.id)
        await db_session.commit()
        await db_session.refresh(user)
    return changes


async def seed(
    accounts: Sequence[QAAccount], db_session: AsyncSession, redis_client: Redis, *, restore: bool = False
) -> dict[str, list[str]]:
    return {
        account.id: await seed_account(account, db_session, redis_client, restore=restore)
        for account in accounts
    }
