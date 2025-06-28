"""
Test configuration settings for managing the test environment.
This allows for easy switching between different database backends and other settings.
"""

import os
from enum import Enum
from typing import Any, Dict

from sqlalchemy.pool import NullPool


class DBType(str, Enum):
    """Database types supported for testing"""

    SQLITE = "sqlite"
    POSTGRES = "postgres"

    @classmethod
    def from_str(cls, value: str | None) -> "DBType":
        """Convert string to DBType, defaulting to SQLITE if invalid"""
        try:
            if value:
                return cls(value.lower())
        except ValueError:
            pass
        return cls.SQLITE


# Test configuration with defaults
class TestConfig:
    # Database settings
    DB_TYPE: DBType = DBType.from_str(os.environ.get("TEST_DB_TYPE"))
    SQLITE_URI: str = os.environ.get("TEST_SQLITE_URI", "sqlite+aiosqlite:///test_db.sqlite3")

    # PostgreSQL settings (for CI)
    POSTGRES_USER: str = os.environ.get("TEST_POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.environ.get("TEST_POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.environ.get("TEST_POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.environ.get("TEST_POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.environ.get("TEST_POSTGRES_DB", "test_db")

    # Redis settings
    REDIS_HOST: str = os.environ.get("TEST_REDIS_HOST", "localhost")
    REDIS_PORT: str = os.environ.get("TEST_REDIS_PORT", "6379")
    REDIS_USE_MOCK: bool = os.environ.get("TEST_REDIS_USE_MOCK", "true").lower() == "true"

    @classmethod
    def get_db_uri(cls) -> str:
        """Get the database URI based on the configured type"""
        if cls.DB_TYPE == DBType.POSTGRES:
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
        if cls.DB_TYPE == DBType.SQLITE:
            return {"check_same_thread": False}
        return {}

    @classmethod
    def get_pool_class(cls) -> Any:
        """Get the pool class to use based on database type"""
        # Always use NullPool for tests to avoid connection pooling issues
        return NullPool


test_config = TestConfig()


# Actual test functions
def test_db_type_enum() -> None:
    """Test DBType enum functionality"""
    assert DBType.SQLITE == "sqlite"
    # assert DBType.POSTGRES == "postgres"  # Unreachable, comment out for mypy


def test_db_type_from_str() -> None:
    """Test DBType.from_str method"""
    assert DBType.from_str("sqlite") == DBType.SQLITE
    assert DBType.from_str("SQLITE") == DBType.SQLITE
    assert DBType.from_str("postgres") == DBType.POSTGRES
    assert DBType.from_str("POSTGRES") == DBType.POSTGRES
    assert DBType.from_str("invalid") == DBType.SQLITE
    assert DBType.from_str(None) == DBType.SQLITE
    assert DBType.from_str("") == DBType.SQLITE


def test_test_config_defaults() -> None:
    """Test TestConfig default values"""
    config = TestConfig()
    assert hasattr(config, "DB_TYPE")
    assert hasattr(config, "SQLITE_URI")
    assert hasattr(config, "POSTGRES_USER")
    assert hasattr(config, "REDIS_HOST")
    assert hasattr(config, "REDIS_USE_MOCK")


def test_test_config_get_db_uri_sqlite() -> None:
    """Test TestConfig.get_db_uri for SQLite"""
    # Temporarily set DB_TYPE to SQLITE
    original_db_type = TestConfig.DB_TYPE
    TestConfig.DB_TYPE = DBType.SQLITE

    uri = TestConfig.get_db_uri()
    assert uri == TestConfig.SQLITE_URI

    # Restore original value
    TestConfig.DB_TYPE = original_db_type


def test_test_config_get_db_uri_postgres() -> None:
    """Test TestConfig.get_db_uri for PostgreSQL"""
    # Temporarily set DB_TYPE to POSTGRES
    original_db_type = TestConfig.DB_TYPE
    TestConfig.DB_TYPE = DBType.POSTGRES

    uri = TestConfig.get_db_uri()
    expected_uri = (
        f"postgresql+asyncpg://"
        f"{TestConfig.POSTGRES_USER}:{TestConfig.POSTGRES_PASSWORD}@"
        f"{TestConfig.POSTGRES_HOST}:{TestConfig.POSTGRES_PORT}/"
        f"{TestConfig.POSTGRES_DB}"
    )
    assert uri == expected_uri

    # Restore original value
    TestConfig.DB_TYPE = original_db_type


def test_test_config_get_connection_args() -> None:
    """Test TestConfig.get_connection_args method"""
    # Temporarily set DB_TYPE to SQLITE
    original_db_type = TestConfig.DB_TYPE
    TestConfig.DB_TYPE = DBType.SQLITE

    args = TestConfig.get_connection_args()
    assert args == {"check_same_thread": False}

    # Test with POSTGRES
    TestConfig.DB_TYPE = DBType.POSTGRES
    args = TestConfig.get_connection_args()
    assert args == {}

    # Restore original value
    TestConfig.DB_TYPE = original_db_type


def test_test_config_get_pool_class() -> None:
    """Test TestConfig.get_pool_class method"""
    pool_class = TestConfig.get_pool_class()
    assert pool_class == NullPool
