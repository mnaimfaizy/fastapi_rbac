"""
Database-related test fixtures.
"""

from typing import AsyncGenerator

import pytest_asyncio
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.init_db import init_db

# Set test database URI to use a shared in-memory SQLite database
TEST_SQLALCHEMY_DATABASE_URI = (
    "sqlite+aiosqlite:///file:memory_test_db?cache=shared&uri=true"
)

# Create engine instance for testing
engine = create_async_engine(
    TEST_SQLALCHEMY_DATABASE_URI, echo=False, connect_args={"check_same_thread": False}
)


# Use pytest-asyncio's built-in event_loop fixture instead of defining our own
# The session-scoped loop is configured through the pytest.ini or markers


@pytest_asyncio.fixture(scope="session")
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create test database tables and return engine."""
    # Import all models to ensure they are registered with SQLAlchemy
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

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

        # Debug info for table creation
        def get_debug_info(sync_conn_: Connection) -> tuple[list[str], list[str]]:
            from sqlalchemy import inspect

            inspector = inspect(sync_conn_)
            db_tables_ = inspector.get_table_names()
            metadata_tables_ = list(SQLModel.metadata.tables.keys())
            return db_tables_, metadata_tables_

        db_tables_actual, metadata_tables_known = await conn.run_sync(get_debug_info)
        print(
            f"DEBUG CONTEXT: Tables physically in DB after create_all: {db_tables_actual}"
        )
        print(
            f"DEBUG CONTEXT: Tables known to SQLModel.metadata: {metadata_tables_known}"
        )

    # Initialize database with test data
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        await init_db(session)

    yield engine

    # Cleanup - drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session for tests."""
    async with engine.connect() as connection:
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


@pytest_asyncio.fixture(autouse=True)
async def initialize_db() -> AsyncGenerator[None, None]:
    """Initialize the database for the test session."""
    # Import all models to ensure they are registered
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

    async with engine.begin() as conn:
        print("DEBUG CONTEXT: Initializing database - creating all tables...")
        await conn.run_sync(SQLModel.metadata.create_all)
        print("DEBUG CONTEXT: Database initialized.")
    yield
