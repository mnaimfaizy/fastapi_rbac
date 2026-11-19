"""The migration that drops `User.expiry_date` (#412), in both directions.

Account expiry was stored and returned, and nothing enforced it. Password
expiry is a different column and is not this migration. This file is in
`test/api/` because it needs a database, which `test/unit/` does not have
(ADR 0012 decision 2).
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
MIGRATION_PATH = BACKEND_DIR / "alembic" / "versions" / "2026_11_19_0000_drop_account_expiry_date.py"
USER_TABLE = SQLModel.metadata.tables["User"]
STORED_EXPIRY = "2020-01-01 00:00:00"


def load_migration() -> ModuleType:
    """Import the migration by path -- its filename is not a module name."""
    spec = importlib.util.spec_from_file_location("drop_account_expiry_date", MIGRATION_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MIGRATION = load_migration()


@pytest.fixture
def populated_user_table(tmp_path: Path) -> Iterator[Engine]:
    """Today's schema plus the dropped column, with one row that has a value in it.

    SQLite rather than PostgreSQL, so what this proves is that the batch-mode
    DDL rebuilds the table and carries the row across. PostgreSQL takes the
    plain ``ALTER TABLE ... DROP COLUMN`` path, which is not covered here.
    """
    engine = create_engine(f"sqlite:///{tmp_path / 'pre_migration.db'}")
    SQLModel.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(USER_TABLE.insert().values(email="kept@example.com", password="hash"))
        connection.execute(text('ALTER TABLE "User" ADD COLUMN expiry_date DATETIME'))
        connection.execute(
            text('UPDATE "User" SET expiry_date = :expiry_date'),
            {"expiry_date": STORED_EXPIRY},
        )
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


def test_upgrade_drops_the_column_and_keeps_the_row(populated_user_table: Engine) -> None:
    with populated_user_table.begin() as connection:
        assert "expiry_date" in user_columns(connection)

        upgrade(connection)

        assert "expiry_date" not in user_columns(connection)
        emails = connection.execute(text('SELECT email FROM "User"')).scalars().all()
        assert emails == ["kept@example.com"]


def test_downgrade_restores_a_nullable_column_without_the_old_value(populated_user_table: Engine) -> None:
    """Reversible in shape, not in value -- the stored dates are not recoverable."""
    with populated_user_table.begin() as connection:
        upgrade(connection)

        downgrade(connection)

        assert "expiry_date" in user_columns(connection)
        columns = inspect(connection).get_columns("User")
        column = next(item for item in columns if item["name"] == "expiry_date")
        assert column["nullable"] is True
        values = connection.execute(text('SELECT expiry_date FROM "User"')).scalars().all()
        assert values == [None]
