"""The migration that adds `description` to both group tables (#452), in both directions.

This file is in `test/api/` because it needs a database, which `test/unit/`
does not have (ADR 0012 decision 2).
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
from app.models.permission_group_model import PermissionGroup  # noqa: F401  registers the table
from app.models.role_group_model import RoleGroup  # noqa: F401  registers the table

BACKEND_DIR = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_DIR / "alembic" / "versions" / "2026_11_27_0000_add_group_descriptions.py"
TABLES = ["RoleGroup", "PermissionGroup"]


def load_migration() -> ModuleType:
    """Import the migration by path -- its filename is not a module name."""
    spec = importlib.util.spec_from_file_location("add_group_descriptions", MIGRATION_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MIGRATION = load_migration()


@pytest.fixture
def populated_group_tables(tmp_path: Path) -> Iterator[Engine]:
    """The schema before this migration, with one group of each kind.

    SQLite rather than PostgreSQL, so what this proves is that the batch-mode
    DDL carries the rows across in both directions.
    """
    engine = create_engine(f"sqlite:///{tmp_path / 'pre_migration.db'}")
    SQLModel.metadata.create_all(engine)
    with engine.begin() as connection:
        for table in TABLES:
            connection.execute(SQLModel.metadata.tables[table].insert().values(name=f"kept {table}"))
            connection.execute(text(f'ALTER TABLE "{table}" DROP COLUMN description'))
    yield engine
    engine.dispose()


def column(connection: Connection, table: str, name: str) -> dict | None:
    columns = inspect(connection).get_columns(table)
    return next((dict(item) for item in columns if item["name"] == name), None)


def names(connection: Connection, table: str) -> list[str]:
    return list(connection.execute(text(f'SELECT name FROM "{table}"')).scalars().all())


def upgrade(connection: Connection) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        MIGRATION.upgrade()


def downgrade(connection: Connection) -> None:
    with Operations.context(MigrationContext.configure(connection)):
        MIGRATION.downgrade()


def test_follows_the_previous_head() -> None:
    assert MIGRATION.down_revision == "2026_11_19_0000"


@pytest.mark.parametrize("table", TABLES)
def test_upgrade_adds_a_nullable_column_and_keeps_the_rows(
    populated_group_tables: Engine, table: str
) -> None:
    with populated_group_tables.begin() as connection:
        assert column(connection, table, "description") is None

        upgrade(connection)

        added = column(connection, table, "description")
        assert added is not None
        assert added["nullable"] is True
        assert added["type"].length == 255
        assert names(connection, table) == [f"kept {table}"]


@pytest.mark.parametrize("table", TABLES)
def test_downgrade_drops_the_column_and_keeps_the_rows(populated_group_tables: Engine, table: str) -> None:
    with populated_group_tables.begin() as connection:
        upgrade(connection)

        downgrade(connection)

        assert column(connection, table, "description") is None
        assert names(connection, table) == [f"kept {table}"]
