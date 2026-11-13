"""
Database-related test fixtures.

The schema and the init_db seed are built once per test session (per xdist
worker). Rebuilding them for every test cost ~2.7s of setup per test, which
was almost all of Backend CI's runtime. Each test is isolated instead by the
``db`` fixture: it runs inside an outer transaction that is rolled back at
teardown, and app code that commits only releases a SAVEPOINT inside it.

That isolation is checked rather than assumed. After every test that used
``db``, every table is fingerprinted (row count plus a hash of its rows in
primary-key order) and compared with the fingerprint the seed produced. Rows
added, removed or changed all show up, including an UPDATE to a seeded row
such as the superuser's password. A test that leaks fails its teardown naming
the tables, and the seed is rebuilt so the leak cannot spill into later tests.
"""

import asyncio
import hashlib
import os
from collections.abc import AsyncGenerator, Coroutine
from typing import Any, TypeVar

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.init_db import init_db

# Import every model so SQLModel.metadata knows all tables before create_all.
from app.models.audit_log_model import AuditLog  # noqa: F401
from app.models.base_uuid_model import SQLModel
from app.models.password_history_model import UserPasswordHistory  # noqa: F401
from app.models.permission_group_model import PermissionGroup  # noqa: F401
from app.models.permission_model import Permission  # noqa: F401
from app.models.role_group_map_model import RoleGroupMap  # noqa: F401
from app.models.role_group_model import RoleGroup  # noqa: F401
from app.models.role_model import Role  # noqa: F401
from app.models.role_permission_model import RolePermission  # noqa: F401
from app.models.user_model import User  # noqa: F401
from app.models.user_role_model import UserRole  # noqa: F401

# DATABASE_URL when provided (the Docker integration runner sets a Postgres
# URL), else a SQLite file. Despite the name it is a file on disk, not an
# in-memory database: the URI has no mode=memory. The files are git-ignored.
TEST_SQLALCHEMY_DATABASE_URI = os.getenv(
    "DATABASE_URL", "sqlite+aiosqlite:///file:memory_test_db?cache=shared&uri=true"
)

# Make the SQLite file unique per pytest-xdist worker for parallel safety
worker_id = os.environ.get("PYTEST_XDIST_WORKER", "default")
if "sqlite" in TEST_SQLALCHEMY_DATABASE_URI:
    TEST_SQLALCHEMY_DATABASE_URI = TEST_SQLALCHEMY_DATABASE_URI.replace(
        "memory_test_db", f"memory_test_db_{worker_id}"
    )

IS_POSTGRES = TEST_SQLALCHEMY_DATABASE_URI.startswith("postgresql")

# Per table: (row count, sha256 of its rows in primary-key order)
Fingerprint = dict[str, tuple[int, str]]
T = TypeVar("T")


def _new_engine() -> AsyncEngine:
    if TEST_SQLALCHEMY_DATABASE_URI.startswith("sqlite"):
        # timeout reduces flaky "database is locked" under shared-cache aiosqlite on Windows
        connect_args: dict[str, Any] = {"check_same_thread": False, "timeout": 30}
    else:
        connect_args = {}
    return create_async_engine(TEST_SQLALCHEMY_DATABASE_URI, echo=False, connect_args=connect_args)


async def _drop_schema(conn: AsyncConnection) -> None:
    if IS_POSTGRES:
        # CASCADE also drops objects create_all does not know about
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
    else:
        await conn.run_sync(SQLModel.metadata.drop_all)


async def _fingerprint(engine: AsyncEngine) -> Fingerprint:
    """Fingerprint every table's contents, so an UPDATE is caught as well as an INSERT or DELETE.

    The seed is a few dozen rows, so hashing all of them costs milliseconds.
    """
    result: Fingerprint = {}
    async with engine.connect() as conn:
        for table in SQLModel.metadata.sorted_tables:
            rows = (await conn.execute(select(table).order_by(*table.primary_key.columns))).all()
            digest = hashlib.sha256()
            for row in rows:
                digest.update(repr(tuple(row)).encode())
            result[table.name] = (len(rows), digest.hexdigest())
    return result


async def _build_seeded_database() -> Fingerprint:
    """Drop whatever is there, create the schema, seed it, return its fingerprint."""
    engine = _new_engine()
    try:
        # Dropping first matters: the SQLite file outlives the run, so a run
        # that was killed mid-way leaves its rows behind for the next one.
        async with engine.begin() as conn:
            await _drop_schema(conn)
            await conn.run_sync(SQLModel.metadata.create_all)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            await init_db(session)
        return await _fingerprint(engine)
    finally:
        await engine.dispose()


async def _drop_database() -> None:
    engine = _new_engine()
    try:
        async with engine.begin() as conn:
            await _drop_schema(conn)
    finally:
        await engine.dispose()


def _run_on_private_loop(coro: Coroutine[Any, Any, T]) -> T:
    # Not asyncio.run(): it ends by clearing the thread's current event loop,
    # which would pull the loop out from under pytest-asyncio. The engines
    # used here are disposed inside the coroutine, so nothing outlives the loop.
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="session")
def seeded_database() -> Any:
    """Build the schema and init_db seed once; yield the seed's fingerprint.

    Synchronous on purpose: a session-scoped async fixture would need a
    session-scoped event loop, while every test runs on its own function loop.
    """
    seed = {"value": _run_on_private_loop(_build_seeded_database())}
    yield seed
    _run_on_private_loop(_drop_database())


@pytest_asyncio.fixture(scope="function")
async def db_engine(seeded_database: Any) -> AsyncGenerator[AsyncEngine, None]:
    """Return an engine on the seeded test database.

    Function-scoped because pooled connections belong to the event loop that
    opened them, and each test has its own loop. Creating an engine is cheap;
    it was the schema build and the seed that were not.
    """
    engine = _new_engine()
    yield engine
    await engine.dispose()


def _describe_leak(seeded: Fingerprint, now: Fingerprint) -> str:
    changed = []
    for name, (count, digest) in now.items():
        seeded_count, seeded_digest = seeded.get(name, (None, None))
        if seeded_count != count:
            changed.append(f"{name}: {seeded_count} -> {count} rows")
        elif seeded_digest != digest:
            changed.append(f"{name}: row contents changed")
    return ", ".join(changed)


@pytest_asyncio.fixture(scope="function")
async def db(db_engine: AsyncEngine, seeded_database: Any) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session whose writes are rolled back after the test."""
    async with db_engine.connect() as connection:
        await connection.begin()
        await connection.begin_nested()

        async_session_local = async_sessionmaker(
            bind=connection,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )

        async with async_session_local() as session:
            yield session
            await session.flush()
            await session.rollback()

    now = await _fingerprint(db_engine)
    if now != seeded_database["value"]:
        leak = _describe_leak(seeded_database["value"], now)
        seeded_database["value"] = await _build_seeded_database()
        pytest.fail(
            f"Writes survived this test's rollback, so it is not isolated ({leak}). "
            "The seed was rebuilt so later tests are unaffected."
        )
