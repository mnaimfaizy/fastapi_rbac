"""The migration that clears every ``needs_to_change_password`` before enforcement (#273).

Until #273 the ``User`` model defaulted the flag to ``True`` and the create
schema inherited that default, so self-registration stored ``True`` for every
user who never changed or reset their password. Enforcing the flag over those
rows would force a password change on people who chose their own. Nothing
distinguishes them from rows an administrator flagged, so every existing flag
is cleared; admin create and admin set flag users again from the deploy on.
ADR 0014 records the decision.

Here rather than in ``test/unit/`` because it needs a database (ADR 0012
decision 2).
"""

import importlib.util
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.models.base_uuid_model import SQLModel
from app.models.user_model import User  # noqa: F401  registers the mapped table

BACKEND_DIR = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_DIR / "alembic" / "versions" / "2026_11_10_0000_clear_temporary_password_flags.py"
USER_TABLE = SQLModel.metadata.tables["User"]


def load_migration() -> ModuleType:
    """Import the migration by path -- its filename is not a module name."""
    spec = importlib.util.spec_from_file_location("clear_temporary_password_flags", MIGRATION_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def flagged_users(tmp_path: Path) -> Iterator[Engine]:
    engine = create_engine(f"sqlite:///{tmp_path / 'pre_migration.db'}")
    SQLModel.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(
            USER_TABLE.insert(),
            [
                {
                    "email": "self-registered@example.com",
                    "password": "hash",
                    "needs_to_change_password": True,
                },
                {"email": "admin-made@example.com", "password": "hash", "needs_to_change_password": True},
                {"email": "changed@example.com", "password": "hash", "needs_to_change_password": False},
            ],
        )
    yield engine
    engine.dispose()


def run(connection: Connection, step: str) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        getattr(load_migration(), step)()


def flags(connection: Connection) -> dict[str, bool]:
    rows = connection.execute(text('SELECT email, needs_to_change_password FROM "User"')).all()
    return {email: bool(flag) for email, flag in rows}


def test_upgrade_clears_every_flag(flagged_users: Engine) -> None:
    with flagged_users.begin() as connection:
        run(connection, "upgrade")

        assert flags(connection) == {
            "self-registered@example.com": False,
            "admin-made@example.com": False,
            "changed@example.com": False,
        }


def test_downgrade_changes_nothing(flagged_users: Engine) -> None:
    """Not reversible in value: which rows were flagged is not recoverable."""
    with flagged_users.begin() as connection:
        run(connection, "upgrade")

        run(connection, "downgrade")

        assert set(flags(connection).values()) == {False}
