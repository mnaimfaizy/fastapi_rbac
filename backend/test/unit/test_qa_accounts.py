"""QA Accounts seeder (#318): local-only refusal, idempotence and drift repair.

Seams: ``refusal`` (the pure rule), ``main`` (the CLI, which must refuse
before touching a database) and ``seed`` (the database work).
"""

from typing import Any

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

import app.qa_accounts.__main__ as cli
from app.core.config import ModeEnum
from app.core.security import PasswordValidator
from app.crud.role_crud import role_crud
from app.crud.user_crud import user_crud
from app.models.password_history_model import UserPasswordHistory
from app.models.role_model import Role
from app.models.user_model import User
from app.qa_accounts.accounts import (
    ACCOUNTS,
    EMAIL_DOMAIN,
    QAAccountsError,
    fixture_password,
    refusal,
    select_accounts,
)
from app.qa_accounts.seeding import seed

PG = "postgresql+asyncpg://postgres:postgres@{host}:5432/fastapi_db"


# --- the values -------------------------------------------------------------


def test_roles_cover_admin_manager_and_user() -> None:
    assert {a.id: a.role for a in ACCOUNTS} == {"admin": "Admin", "manager": "Manager", "user": "User"}
    assert all(a.purpose for a in ACCOUNTS)


def test_values_are_fixed_and_on_a_reserved_domain() -> None:
    for account in ACCOUNTS:
        assert account.email == f"{account.id}@{EMAIL_DOMAIN}"
        assert EMAIL_DOMAIN.endswith(".example")
        assert account.password == fixture_password(account.id)  # derived, so the same on every machine
        assert PasswordValidator.validate_complexity(account.password) == (True, [])
    assert len({a.password for a in ACCOUNTS}) == len(ACCOUNTS)


# --- local database or not at all ------------------------------------------


@pytest.mark.parametrize(
    "host",
    ["localhost", "127.0.0.1", "[::1]", "db.localhost", "fastapi_rbac_db_dev", "fastapi_rbac_db_test"],
)
def test_local_hosts_are_allowed(host: str) -> None:
    assert refusal(mode=ModeEnum.development, database_url=PG.format(host=host)) is None


def test_sqlite_is_a_local_file() -> None:
    assert refusal(mode=ModeEnum.testing, database_url="sqlite+aiosqlite:///./app.db") is None


@pytest.mark.parametrize(
    "host",
    [
        "db",
        "postgres",
        "db.internal",
        "prod-db.example.com",
        "10.0.0.5",
        "fastapi_rbac_db_prod",
        "localhost.evil.com",
    ],
)
def test_non_local_hosts_are_refused(host: str) -> None:
    reason = refusal(mode=ModeEnum.development, database_url=PG.format(host=host))
    assert reason is not None
    assert "not local" in reason


@pytest.mark.parametrize("url", [PG.format(host="localhost"), "sqlite+aiosqlite:///./app.db"])
def test_production_is_refused_even_on_a_local_database(url: str) -> None:
    assert refusal(mode=ModeEnum.production, database_url=url) == "MODE is production"


def test_there_is_no_override(monkeypatch: pytest.MonkeyPatch) -> None:
    # Neither the CLI nor the rule takes anything that could lift a refusal.
    with pytest.raises(SystemExit):
        cli._parse(["seed", "--force"])
    with pytest.raises(TypeError):
        refusal(  # type: ignore[call-arg]
            mode=ModeEnum.production, database_url=PG.format(host="localhost"), force=True
        )


def _settings_like(mode: ModeEnum, url: str) -> Any:
    return type("S", (), {"MODE": mode, "ASYNC_DATABASE_URI": url})()


@pytest.mark.parametrize(
    ("mode", "url"),
    [
        (ModeEnum.development, PG.format(host="prod-db.example.com")),
        (ModeEnum.production, PG.format(host="localhost")),
    ],
)
@pytest.mark.parametrize(
    "argv", [["seed"], ["seed", "--account", "admin"], ["seed", "--restore", "--account", "user"]]
)
def test_cli_refuses_before_opening_a_session(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    mode: ModeEnum,
    url: str,
    argv: list[str],
) -> None:
    monkeypatch.setattr(cli, "settings", _settings_like(mode, url))

    async def must_not_run(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("seed ran against a refused database")

    monkeypatch.setattr(cli, "_run_seed", must_not_run)

    assert cli.main(argv) == 1
    assert "refusing to seed" in capsys.readouterr().err


def test_print_needs_no_database(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(cli, "settings", _settings_like(ModeEnum.production, PG.format(host="db.internal")))

    assert cli.main(["print", "--account", "manager"]) == 0
    out = capsys.readouterr().out.strip().splitlines()
    assert out == [
        f"id=manager role=Manager email=manager@{EMAIL_DOMAIN} password={fixture_password('manager')}"
    ]


def test_restore_needs_an_account() -> None:
    with pytest.raises(SystemExit):
        cli._parse(["seed", "--restore"])


def test_unknown_account_is_an_error() -> None:
    with pytest.raises(QAAccountsError, match="no QA Account 'nobody'"):
        select_accounts("nobody")


# --- seeding ----------------------------------------------------------------


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


async def test_seed_creates_verified_active_users_holding_their_role(db: AsyncSession) -> None:
    await _roles(db)

    results = await seed(ACCOUNTS, db)

    assert results == {a.id: ["created"] for a in ACCOUNTS}
    for account in ACCOUNTS:
        user = await _user(db, account.id)
        assert user.verified
        assert user.is_active
        assert not user.is_superuser
        assert not user.needs_to_change_password
        assert [r.name for r in user.roles] == [account.role]
        assert user.password is not None
        assert PasswordValidator.verify_password(account.password, user.password)


async def test_a_second_seed_changes_nothing(db: AsyncSession) -> None:
    await _roles(db)
    await seed(ACCOUNTS, db)
    before = {a.id: (await _user(db, a.id)).model_dump() for a in ACCOUNTS}

    results = await seed(ACCOUNTS, db)

    assert results == {a.id: [] for a in ACCOUNTS}
    assert {a.id: (await _user(db, a.id)).model_dump() for a in ACCOUNTS} == before


async def test_account_limits_seed_to_one_account(db: AsyncSession) -> None:
    await _roles(db)

    assert await seed(select_accounts("manager"), db) == {"manager": ["created"]}
    assert await user_crud.get_by_email(email=f"admin@{EMAIL_DOMAIN}", db_session=db) is None


async def test_seed_refuses_when_the_roles_are_missing(
    db: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Roles come from init_db; without them there is nothing to hold.
    async def no_role(**kwargs: Any) -> None:
        return None

    monkeypatch.setattr(role_crud, "get_role_by_name", no_role)

    with pytest.raises(QAAccountsError, match="initial_data"):
        await seed(select_accounts("admin"), db)
    assert await user_crud.get_by_email(email=f"admin@{EMAIL_DOMAIN}", db_session=db) is None


async def test_seed_puts_back_what_drifted(db: AsyncSession) -> None:
    roles = await _roles(db)
    await seed(ACCOUNTS, db)
    user = await _user(db, "manager")
    user.password = PasswordValidator.get_password_hash("Someone-Else-9x")
    user.verified = False
    user.is_active = False
    user.is_locked = True
    user.needs_to_change_password = True
    user.roles = [roles["Admin"], roles["User"]]
    db.add(user)
    await db.commit()

    results = await seed(ACCOUNTS, db)

    assert results["admin"] == []
    assert results["user"] == []
    assert results["manager"][:5] == [
        "reset password",
        "marked verified",
        "re-enabled",
        "unlocked",
        "cleared the temporary-password flag",
    ]
    assert results["manager"][5].startswith("set roles to [Manager]")
    user = await _user(db, "manager")
    assert user.password is not None
    assert PasswordValidator.verify_password(fixture_password("manager"), user.password)
    assert user.verified
    assert user.is_active
    assert not user.is_locked
    assert not user.needs_to_change_password
    assert [r.name for r in user.roles] == ["Manager"]
    assert await seed(ACCOUNTS, db) == {a.id: [] for a in ACCOUNTS}


async def test_seed_keeps_profile_edits_but_restore_puts_them_back(db: AsyncSession) -> None:
    await _roles(db)
    await seed(ACCOUNTS, db)
    user = await _user(db, "user")
    user.first_name = "Renamed"
    user.contact_phone = "+15550100"
    db.add(user)
    db.add(UserPasswordHistory(user_id=user.id, password_hash="old-one"))
    db.add(UserPasswordHistory(user_id=user.id, password_hash="old-two"))
    await db.commit()

    assert (await seed(select_accounts("user"), db)) == {"user": []}

    results = await seed(select_accounts("user"), db, restore=True)

    assert results == {"user": ["reset name", "cleared contact phone", "deleted 2 password-history rows"]}
    user = await _user(db, "user")
    assert (user.first_name, user.contact_phone) == ("QA", None)
    history = await db.exec(select(UserPasswordHistory).where(UserPasswordHistory.user_id == user.id))
    assert history.all() == []
