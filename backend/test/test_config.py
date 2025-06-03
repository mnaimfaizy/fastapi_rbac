"""
Test configuration settings for managing the test environment.
This allows for easy switching between different database backends and other settings.
"""

import os
from enum import Enum
from typing import Any, Dict

from sqlalchemy.pool import NullPool


class TestDBType(str, Enum):
    """Database types supported for testing"""

    SQLITE = "sqlite"
    POSTGRES = "postgres"

    @classmethod
    def from_str(cls, value: str | None) -> "TestDBType":
        """Convert string to TestDBType, defaulting to SQLITE if invalid"""
        try:
            if value:
                return cls(value.lower())
        except ValueError:
            pass
        return cls.SQLITE


# Test configuration with defaults
class TestConfig:
    # Database settings
    DB_TYPE: TestDBType = TestDBType.from_str(os.environ.get("TEST_DB_TYPE"))
    SQLITE_URI: str = os.environ.get(
        "TEST_SQLITE_URI", "sqlite+aiosqlite:///test_db.sqlite3"
    )

    # PostgreSQL settings (for CI)
    POSTGRES_USER: str = os.environ.get("TEST_POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.environ.get("TEST_POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.environ.get("TEST_POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.environ.get("TEST_POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.environ.get("TEST_POSTGRES_DB", "test_db")

    # Redis settings
    REDIS_HOST: str = os.environ.get("TEST_REDIS_HOST", "localhost")
    REDIS_PORT: str = os.environ.get("TEST_REDIS_PORT", "6379")
    REDIS_USE_MOCK: bool = (
        os.environ.get("TEST_REDIS_USE_MOCK", "true").lower() == "true"
    )

    @classmethod
    def get_db_uri(cls) -> str:
        """Get the database URI based on the configured type"""
        if cls.DB_TYPE == TestDBType.POSTGRES:
            return (
                f"postgresql+asyncpg://"
                f"{cls.POSTGRES_USER}:{cls.POSTGRES_PASSWORD}@"
                f"{cls.POSTGRES_HOST}:{cls.POSTGRES_PORT}/"
                f"{cls.POSTGRES_DB}"
            )
        return cls.SQLITE_URI

    @classmethod
    def get_connection_args(cls) -> Dict[str, Any]:
        """Get connection arguments specific to the database type"""
        if cls.DB_TYPE == TestDBType.SQLITE:
            return {"check_same_thread": False}
        return {}

    @classmethod
    def get_pool_class(cls) -> Any:
        """Get the pool class to use based on database type"""
        # Always use NullPool for tests to avoid connection pooling issues
        return NullPool


test_config = TestConfig()
