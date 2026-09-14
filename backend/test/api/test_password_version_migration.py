"""The migration that drops `User.password_version` (#68), in both directions.

The retirement decision and its rationale are in ADR 0011 decision 3; the
tripwires that keep the field from returning are in
`test/unit/test_password_version_retired.py`. This file is separate because it
needs a database, which `test/unit/` does not have (ADR 0012 decision 2).
"""

import importlib.util
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection, Engine

from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.models.base_uuid_model import SQLModel
from app.models.user_model import User  # noqa: F401  registers the mapped table

BACKEND_DIR = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_DIR / "alembic" / "versions" / "2026_09_05_0000_drop_password_version.py"
USER_TABLE = SQLModel.metadata.tables["User"]


def load_migration() -> ModuleType:
    """Import the migration by path -- its filename is not a module name."""
    spec = importlib.util.spec_from_file_location("drop_password_version", MIGRATION_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MIGRATION = load_migration()


@pytest.fixture
def populated_user_table(tmp_path: Path) -> Iterator[Engine]:
    """A pre-migration `User` table: today's schema plus the dropped column, with a row.

    SQLite rather than PostgreSQL, so what this proves is that the batch-mode
    DDL rebuilds the table and carries the rows across. PostgreSQL takes the
    plain `ALTER TABLE ... DROP COLUMN` path, which is not covered here.
    """
    engine = create_engine(f"sqlite:///{tmp_path / 'pre_migration.db'}")
    SQLModel.metadata.create_all(engine)
    with engine.begin() as connection:
        # Insert through the table so every column default still applies, then
        # graft the dropped column on to reconstruct the pre-migration schema.
        connection.execute(USER_TABLE.insert().values(email="kept@example.com", password="hash"))
        connection.execute(text('ALTER TABLE "User" ADD COLUMN password_version INTEGER NOT NULL DEFAULT 1'))
        connection.execute(text('UPDATE "User" SET password_version = 7'))
    yield engine
    engine.dispose()


def user_columns(connection: Connection) -> set[str]:
    return {column["name"] for column in inspect(connection).get_columns("User")}


def upgrade(connection: Connection) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        MIGRATION.upgrade()


def downgrade(connection: Connection) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        MIGRATION.downgrade()


def test_upgrade_drops_the_column_and_keeps_the_rows(populated_user_table: Engine) -> None:
    with populated_user_table.begin() as connection:
        assert "password_version" in user_columns(connection)

        upgrade(connection)

        assert "password_version" not in user_columns(connection)
        assert connection.execute(text('SELECT email FROM "User"')).scalars().all() == ["kept@example.com"]


def test_downgrade_restores_the_column_with_its_default(populated_user_table: Engine) -> None:
    """Reversible in shape, not in value -- the per-user counters are not recoverable."""
    with populated_user_table.begin() as connection:
        upgrade(connection)

        downgrade(connection)

        assert "password_version" in user_columns(connection)
        assert connection.execute(text('SELECT password_version FROM "User"')).scalars().all() == [1]
