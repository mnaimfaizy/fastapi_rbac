"""The password policy module, through its interface (#271).

Every path that sets a password calls ``change_password`` or
``accept_initial_password``. What each reason does to the account, the history
and the allowlist is therefore asserted here once, per reason and per outcome,
rather than route by route. The API tests keep one test per route per outcome
class and assert status and body only.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from typing import Any, List, Optional
from uuid import uuid4

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import PasswordValidator
from app.crud.user_crud import user_crud
from app.models.audit_log_model import AuditLog
from app.models.password_history_model import UserPasswordHistory
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.password_policy import (
    PASSWORD_COMPLEXITY_FAILURE_MESSAGE,
    InitialPasswordReason,
    PasswordChangeReason,
    PasswordRefusalKind,
    PasswordRefused,
    accept_initial_password,
    change_password,
)
from app.utils.token import add_token_to_redis, get_valid_tokens

CURRENT_PASSWORD = "QaRegisterPass!47"
NEW_PASSWORD = "ReplacementPassword!42"
WEAK_PASSWORD = "password"
CLIENT_ADDRESS = "203.0.113.9"

ALL_REASONS = list(PasswordChangeReason)

RULES_REFUSED_EVENT = {
    PasswordChangeReason.SELF: "password_change_complexity_failed",
    PasswordChangeReason.RESET: "password_reset_complexity_failed",
    PasswordChangeReason.ADMIN: "admin_user_update_password_complexity_failed",
}
REUSE_REFUSED_EVENT = {
    PasswordChangeReason.SELF: "password_change_reused_password",
    PasswordChangeReason.RESET: "password_reset_history_violation",
    PasswordChangeReason.ADMIN: "admin_user_update_password_reused_password",
}
SUCCEEDED_EVENT = {
    PasswordChangeReason.SELF: "password_change_successful",
    PasswordChangeReason.RESET: "password_reset_successful",
    PasswordChangeReason.ADMIN: "admin_user_update_password_successful",
}


def _admin() -> User:
    return User(id=uuid4(), email="admin@example.com", first_name="An", last_name="Admin")


def _actor_for(reason: PasswordChangeReason, user: User) -> Optional[User]:
    return {
        PasswordChangeReason.SELF: user,
        PasswordChangeReason.RESET: None,
        PasswordChangeReason.ADMIN: _admin(),
    }[reason]


async def _locked_user_with_sessions(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> User:
    """A locked-out user holding a session and a pending reset link."""
    user = await user_factory.create(
        password=CURRENT_PASSWORD,
        verified=True,
        is_active=True,
        is_locked=True,
        locked_until=None,
        number_of_failed_attempts=settings.MAX_LOGIN_ATTEMPTS,
    )
    # The factory only flushes. Commit so the user predates the change, as it
    # does in production, and a rollback cannot take the row with it.
    await db.commit()
    for token_type, token in (
        (TokenType.ACCESS, "prior-access"),
        (TokenType.REFRESH, "prior-refresh"),
        (TokenType.RESET, "prior-reset"),
    ):
        await add_token_to_redis(redis_mock, user, token, token_type, 30)
    return user


async def _change(
    user: User,
    password: str,
    reason: PasswordChangeReason,
    db: AsyncSession,
    redis_client: Any,
) -> User:
    return await change_password(
        user,
        password,
        reason=reason,
        actor=_actor_for(reason, user),
        client_address=CLIENT_ADDRESS,
        db_session=db,
        redis_client=redis_client,
    )


async def _history(db: AsyncSession, user_id: Any) -> List[UserPasswordHistory]:
    result = await db.exec(select(UserPasswordHistory).where(UserPasswordHistory.user_id == user_id))
    return list(result.all())


async def _audit_actions(db: AsyncSession) -> List[str]:
    result = await db.exec(select(AuditLog.action))
    return list(result.all())


async def _reload(db: AsyncSession, user_id: Any) -> User:
    db.expunge_all()
    reloaded = await user_crud.get(id=user_id, db_session=db)
    assert reloaded is not None
    return reloaded


async def _session_count(redis_mock: MockRedisClient, user_id: Any) -> int:
    total = 0
    for token_type in (TokenType.ACCESS, TokenType.REFRESH, TokenType.RESET):
        total += len(await get_valid_tokens(redis_mock, user_id, token_type))
    return total


async def _assert_nothing_changed(
    db: AsyncSession, redis_mock: MockRedisClient, user_id: Any, original_hash: str
) -> None:
    reloaded = await _reload(db, user_id)
    assert reloaded.password == original_hash
    assert await _history(db, user_id) == []
    assert reloaded.is_locked is True
    assert await _session_count(redis_mock, user_id) == 3


# --------------------------------------------------------------------------
# change_password: reason x {rules refused, reuse refused, succeeded}
# --------------------------------------------------------------------------


@pytest.mark.parametrize("reason", ALL_REASONS)
async def test_rules_refused(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, reason: PasswordChangeReason
) -> None:
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    user_id, original_hash = user.id, user.password

    with pytest.raises(PasswordRefused) as refused:
        await _change(user, WEAK_PASSWORD, reason, db, redis_mock)

    assert refused.value.kind is PasswordRefusalKind.RULES
    assert refused.value.detail == {
        "message": PASSWORD_COMPLEXITY_FAILURE_MESSAGE,
        "errors": PasswordValidator.validate_complexity(WEAK_PASSWORD)[1],
    }
    assert await _audit_actions(db) == [RULES_REFUSED_EVENT[reason]]
    await _assert_nothing_changed(db, redis_mock, user_id, original_hash)


@pytest.mark.parametrize("reason", ALL_REASONS)
async def test_reuse_refused(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, reason: PasswordChangeReason
) -> None:
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    user_id, original_hash = user.id, user.password

    with pytest.raises(PasswordRefused) as refused:
        await _change(user, CURRENT_PASSWORD, reason, db, redis_mock)

    assert refused.value.kind is PasswordRefusalKind.REUSE
    assert refused.value.message == "New password must be different from your current password."
    assert refused.value.errors == [refused.value.message]
    assert await _audit_actions(db) == [REUSE_REFUSED_EVENT[reason]]
    await _assert_nothing_changed(db, redis_mock, user_id, original_hash)


@pytest.mark.parametrize("reason", ALL_REASONS)
async def test_succeeded(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, reason: PasswordChangeReason
) -> None:
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    user_id, original_hash = user.id, user.password

    await _change(user, NEW_PASSWORD, reason, db, redis_mock)

    reloaded = await _reload(db, user_id)
    assert reloaded.password is not None
    assert PasswordValidator.verify_password(NEW_PASSWORD, reloaded.password)
    assert reloaded.last_changed_password_date is not None

    history = await _history(db, user_id)
    assert [row.password_hash for row in history] == [original_hash]
    expected_ip = None if reason is PasswordChangeReason.ADMIN else CLIENT_ADDRESS
    assert history[0].created_by_ip == expected_ip

    assert reloaded.is_locked is False
    assert reloaded.locked_until is None
    assert reloaded.number_of_failed_attempts == 0
    assert reloaded.needs_to_change_password is (reason is PasswordChangeReason.ADMIN)

    assert await _session_count(redis_mock, user_id) == 0
    assert await _audit_actions(db) == [SUCCEEDED_EVENT[reason]]


async def test_a_password_inside_the_history_window_is_refused(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient
) -> None:
    """Not just the current password: the stored history is consulted too."""
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    await _change(user, NEW_PASSWORD, PasswordChangeReason.SELF, db, redis_mock)

    with pytest.raises(PasswordRefused) as refused:
        await _change(user, CURRENT_PASSWORD, PasswordChangeReason.SELF, db, redis_mock)

    assert refused.value.kind is PasswordRefusalKind.REUSE
    assert refused.value.message.startswith("Cannot reuse any of your last")


# --------------------------------------------------------------------------
# A partial failure leaves the user logged out with the old password intact
# --------------------------------------------------------------------------


class _FailingRedis:
    """Deletes every allowlist key it is asked to, then fails part way."""

    def __init__(self, inner: MockRedisClient, fail_after: int) -> None:
        self._inner = inner
        self._remaining = fail_after

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)

    async def delete(self, *keys: Any) -> Any:
        if self._remaining <= 0:
            raise ConnectionError("redis went away")
        self._remaining -= 1
        return await self._inner.delete(*keys)


@pytest.mark.parametrize("reason", ALL_REASONS)
async def test_a_redis_failure_leaves_the_stored_password_unchanged(
    db: AsyncSession, user_factory: Any, redis_mock: MockRedisClient, reason: PasswordChangeReason
) -> None:
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    user_id, original_hash = user.id, user.password

    with pytest.raises(ConnectionError):
        await _change(user, NEW_PASSWORD, reason, db, _FailingRedis(redis_mock, fail_after=1))

    # The instance the caller holds is usable and shows the stored state.
    assert user.password == original_hash
    reloaded = await _reload(db, user_id)
    assert reloaded.password == original_hash
    assert await _history(db, user_id) == []
    assert SUCCEEDED_EVENT[reason] not in await _audit_actions(db)


async def test_a_failed_reload_does_not_mask_the_original_failure(
    db: AsyncSession,
    user_factory: Any,
    redis_mock: MockRedisClient,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """If the reload after the rollback fails too, the caller still sees the Redis error."""
    user = await _locked_user_with_sessions(db, user_factory, redis_mock)
    user_id, original_hash = user.id, user.password

    async def refresh_fails(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("database went away")

    monkeypatch.setattr(db, "refresh", refresh_fails)
    with pytest.raises(ConnectionError):
        await _change(
            user, NEW_PASSWORD, PasswordChangeReason.SELF, db, _FailingRedis(redis_mock, fail_after=1)
        )
    monkeypatch.undo()

    assert "Failed to reload user after discarding a password change" in caplog.text
    reloaded = await _reload(db, user_id)
    assert reloaded.password == original_hash


# --------------------------------------------------------------------------
# accept_initial_password: rules only
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("reason", "event"),
    [
        (InitialPasswordReason.REGISTRATION, "registration_password_complexity_failed"),
        (InitialPasswordReason.ADMIN_CREATE, "admin_user_create_password_complexity_failed"),
    ],
)
async def test_initial_password_rules_refused(
    db: AsyncSession, reason: InitialPasswordReason, event: str
) -> None:
    with pytest.raises(PasswordRefused) as refused:
        await accept_initial_password(
            WEAK_PASSWORD, reason=reason, email="new@example.com", actor=None, db_session=db
        )

    assert refused.value.kind is PasswordRefusalKind.RULES
    assert refused.value.message == PASSWORD_COMPLEXITY_FAILURE_MESSAGE
    assert await _audit_actions(db) == [event]


@pytest.mark.parametrize("reason", list(InitialPasswordReason))
async def test_initial_password_accepted(db: AsyncSession, reason: InitialPasswordReason) -> None:
    await accept_initial_password(
        CURRENT_PASSWORD, reason=reason, email="new@example.com", actor=None, db_session=db
    )

    assert await _audit_actions(db) == []


# --------------------------------------------------------------------------
# No way around the module
# --------------------------------------------------------------------------


async def test_crud_update_refuses_a_password_key(db: AsyncSession, user_factory: Any) -> None:
    user = await user_factory.create(password=CURRENT_PASSWORD)

    with pytest.raises(ValueError, match="does not set passwords"):
        await user_crud.update(obj_current=user, obj_new={"password": NEW_PASSWORD}, db_session=db)
