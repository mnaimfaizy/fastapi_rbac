"""The demo accounts are seeded outside production only, and can be retired where they exist.

``init_db`` seeds the superuser and two demo accounts, a Manager and a User,
whose addresses are in the source and whose password is
``FIRST_SUPERUSER_PASSWORD``. Production now seeds the superuser and roles
only. ``python -m app.db.retire_demo_accounts`` deactivates demo accounts an
earlier release left in a production database.
"""

from test.utils import production_kwargs, random_email
from typing import Any

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

import app.db.retire_demo_accounts as retire_cli
from app.core.config import ModeEnum, Settings, settings
from app.core.security import PasswordValidator
from app.crud.user_crud import user_crud
from app.db import init_db as init_db_module
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils import sessions
from app.utils.allowlist import get_valid_tokens

DEMO_EMAILS = ("manager@example.com", "user@example.com")


@pytest.fixture
def _no_fastapi_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """validate_mode_guards reads FASTAPI_ENV from os.environ; start without it."""
    monkeypatch.delenv("FASTAPI_ENV", raising=False)


def _fresh_seed_data(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Point init_db at seed users that do not exist yet, keyed by their usual address.

    The db fixture has already seeded the real addresses, and init_db only
    creates users that are missing.
    """
    tag = random_email().split("@")[0]
    fresh = []
    emails: dict[str, str] = {}
    for i, entry in enumerate(init_db_module.INITIAL_USERS_DATA):
        email = f"{tag}-{i}@example.com"
        emails[entry["user_data"].email] = email
        fresh.append({**entry, "user_data": entry["user_data"].model_copy(update={"email": email})})
    monkeypatch.setattr(init_db_module, "INITIAL_USERS_DATA", fresh)
    monkeypatch.setattr(init_db_module, "SUPERUSER_EMAIL", fresh[0]["user_data"].email)
    return emails


def test_the_demo_accounts_are_the_manager_and_user_addresses() -> None:
    assert set(init_db_module.DEMO_ACCOUNT_EMAILS) == set(DEMO_EMAILS)
    assert settings.FIRST_SUPERUSER_EMAIL not in init_db_module.DEMO_ACCOUNT_EMAILS


# --- seeding ----------------------------------------------------------------


@pytest.mark.usefixtures("_no_fastapi_env")
async def test_production_seeds_the_superuser_but_no_demo_account(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    production = Settings(**production_kwargs())
    monkeypatch.setattr(init_db_module, "settings", production)
    emails = _fresh_seed_data(monkeypatch)

    await init_db_module.init_db(db)

    superuser = await user_crud.get_by_email(email=init_db_module.SUPERUSER_EMAIL, db_session=db)
    assert superuser is not None
    assert superuser.is_superuser
    assert [r.name for r in superuser.roles] == ["Admin"]
    assert PasswordValidator.verify_password(production.FIRST_SUPERUSER_PASSWORD, superuser.password)
    for demo in DEMO_EMAILS:
        assert await user_crud.get_by_email(email=emails[demo], db_session=db) is None, demo


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
async def test_other_modes_seed_the_superuser_and_both_demo_accounts(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch, mode: ModeEnum
) -> None:
    monkeypatch.setattr(init_db_module, "settings", settings.model_copy(update={"MODE": mode}))
    emails = _fresh_seed_data(monkeypatch)

    await init_db_module.init_db(db)

    expected_roles = {
        settings.FIRST_SUPERUSER_EMAIL: "Admin",
        DEMO_EMAILS[0]: "Manager",
        DEMO_EMAILS[1]: "User",
    }
    for usual, role in expected_roles.items():
        user = await user_crud.get_by_email(email=emails[usual], db_session=db)
        assert user is not None, usual
        assert [r.name for r in user.roles] == [role]
        # Unchanged dev convenience: verified, active and no forced password change.
        assert user.verified
        assert user.is_active
        assert not user.needs_to_change_password


# --- retiring them -----------------------------------------------------------


async def _user(db: AsyncSession, email: str) -> User:
    user = await user_crud.get_by_email(email=email, db_session=db)
    assert user is not None, email
    return user


async def _session_count(redis_mock: Any, user: User) -> int:
    total = 0
    for token_type in (TokenType.ACCESS, TokenType.REFRESH):
        total += len(await get_valid_tokens(redis_mock, user.id, token_type))
    return total


async def test_retire_deactivates_each_demo_account_and_ends_its_sessions(
    db: AsyncSession, redis_mock: Any
) -> None:
    # The db fixture seeded in testing mode, so both demo accounts exist.
    for email in DEMO_EMAILS:
        await sessions.open(await _user(db, email), None, redis_client=redis_mock)

    report = await retire_cli.retire_demo_accounts(db, redis_mock)

    assert report == [f"{email}: deactivated" for email in DEMO_EMAILS]
    for email in DEMO_EMAILS:
        user = await _user(db, email)
        assert user.is_active is False
        assert await _session_count(redis_mock, user) == 0
    superuser = await _user(db, settings.FIRST_SUPERUSER_EMAIL)
    assert superuser.is_active is True


async def test_retire_is_idempotent(db: AsyncSession, redis_mock: Any) -> None:
    await retire_cli.retire_demo_accounts(db, redis_mock)

    report = await retire_cli.retire_demo_accounts(db, redis_mock)

    assert report == [f"{email}: already inactive" for email in DEMO_EMAILS]


async def test_retire_reports_a_missing_account(db: AsyncSession, redis_mock: Any) -> None:
    missing = random_email()

    assert await retire_cli.retire_demo_accounts(db, redis_mock, emails=(missing,)) == [
        f"{missing}: not present"
    ]


async def test_retire_never_deactivates_the_superuser(db: AsyncSession, redis_mock: Any) -> None:
    email = settings.FIRST_SUPERUSER_EMAIL

    report = await retire_cli.retire_demo_accounts(db, redis_mock, emails=(email,))

    assert report == [f"{email}: skipped, it is a superuser"]
    assert (await _user(db, email)).is_active is True


@pytest.mark.parametrize("mode", [ModeEnum.development, ModeEnum.testing])
def test_the_command_refuses_outside_production(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], mode: ModeEnum
) -> None:
    monkeypatch.setattr(retire_cli, "settings", settings.model_copy(update={"MODE": mode}))

    async def must_not_run() -> list[str]:
        raise AssertionError("retire ran outside production")

    monkeypatch.setattr(retire_cli, "_run", must_not_run)

    assert retire_cli.main([]) == 1
    assert "only in production" in capsys.readouterr().err


@pytest.mark.usefixtures("_no_fastapi_env")
async def test_the_command_prints_what_it_did_and_no_password(
    db: AsyncSession, redis_mock: Any, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    production = Settings(**production_kwargs())
    monkeypatch.setattr(retire_cli, "settings", production)

    class _Session:
        async def __aenter__(self) -> AsyncSession:
            return db

        async def __aexit__(self, *exc: object) -> None:
            return None

    async def get_client() -> Any:
        return redis_mock

    monkeypatch.setattr("app.db.session.SessionLocal", _Session)
    monkeypatch.setattr("app.utils.redis_connection.RedisConnectionFactory.get_client", get_client)

    report = await retire_cli._run()
    retire_cli._print(report)

    out = capsys.readouterr().out
    assert out.splitlines() == [f"{email}: deactivated" for email in DEMO_EMAILS]
    assert settings.FIRST_SUPERUSER_PASSWORD not in out
    assert production.FIRST_SUPERUSER_PASSWORD not in out
