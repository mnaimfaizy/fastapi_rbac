"""
Service mocks for testing.

This module provides mock implementations of service dependencies
such as Redis clients, email services, etc.
"""

from typing import Any, AsyncGenerator, Dict, List, Optional, Set, Tuple
from unittest.mock import AsyncMock

import pytest_asyncio


class MockRedisClient:
    """Enhanced Redis mock implementation for testing."""

    def __init__(self) -> None:
        """Initialize with storage dictionaries to simulate Redis state."""
        self._storage: Dict[str, Any] = {}  # For key-value storage
        self._sets: Dict[str, Set[Any]] = {}  # For Redis sets
        self._hashes: Dict[str, Dict[str, Any]] = {}  # For Redis hashes
        self._expirations: Dict[str, int] = {}  # For key expirations

        # Create individual method mocks for tracking calls
        self.get = AsyncMock(side_effect=self._get)
        self.set = AsyncMock(side_effect=self._set)
        self.delete = AsyncMock(side_effect=self._delete)
        self.exists = AsyncMock(side_effect=self._exists)
        self.expire = AsyncMock(side_effect=self._expire)

        # Set operations
        self.sadd = AsyncMock(side_effect=self._sadd)
        self.srem = AsyncMock(side_effect=self._srem)
        self.smembers = AsyncMock(side_effect=self._smembers)
        self.sismember = AsyncMock(side_effect=self._sismember)

        # Hash operations
        self.hget = AsyncMock(side_effect=self._hget)
        self.hset = AsyncMock(side_effect=self._hset)
        self.hdel = AsyncMock(side_effect=self._hdel)
        self.hgetall = AsyncMock(side_effect=self._hgetall)

        # Other operations
        self.scan = AsyncMock(side_effect=self._scan)

        # Pipeline support
        self.pipeline = AsyncMock(return_value=self)
        self.execute = AsyncMock(side_effect=self._execute_pipeline)

        # Transaction tracking for pipeline
        self._pipeline_commands: List[Tuple[str, tuple, dict]] = []

    # Key-value operations
    async def _get(self, key: str) -> Any:
        """Get a value by key."""
        return self._storage.get(key)

    async def _set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """Set a key-value pair with optional expiration."""
        self._storage[key] = value
        if ex is not None:
            self._expirations[key] = ex
        return True

    async def _delete(self, key: str) -> bool:
        """Delete a key."""
        if key in self._storage:
            del self._storage[key]
            return True
        return False

    async def _exists(self, key: str) -> bool:
        """Check if key exists."""
        return key in self._storage

    async def _expire(self, key: str, seconds: int) -> bool:
        """Set expiration for a key."""
        if key in self._storage:
            self._expirations[key] = seconds
            return True
        return False

    # Set operations
    async def _sadd(self, key: str, *values: Any) -> int:
        """Add values to a set."""
        if key not in self._sets:
            self._sets[key] = set()

        added_count = 0
        for value in values:
            if value not in self._sets[key]:
                self._sets[key].add(value)
                added_count += 1

        return added_count

    async def _srem(self, key: str, *values: Any) -> int:
        """Remove values from a set."""
        if key not in self._sets:
            return 0

        removed_count = 0
        for value in values:
            if value in self._sets[key]:
                self._sets[key].remove(value)
                removed_count += 1

        return removed_count

    async def _smembers(self, key: str) -> Set[Any]:
        """Get all members of a set."""
        return self._sets.get(key, set()).copy()

    async def _sismember(self, key: str, value: Any) -> bool:
        """Check if value is a member of a set."""
        if key not in self._sets:
            return False
        return value in self._sets[key]

    # Hash operations
    async def _hget(self, key: str, field: str) -> Any:
        """Get a field from a hash."""
        if key not in self._hashes:
            return None
        return self._hashes[key].get(field)

    async def _hset(self, key: str, field: str, value: Any) -> int:
        """Set a field in a hash."""
        if key not in self._hashes:
            self._hashes[key] = {}

        is_new = field not in self._hashes[key]
        self._hashes[key][field] = value
        return 1 if is_new else 0

    async def _hdel(self, key: str, *fields: str) -> int:
        """Delete fields from a hash."""
        if key not in self._hashes:
            return 0

        deleted_count = 0
        for field in fields:
            if field in self._hashes[key]:
                del self._hashes[key][field]
                deleted_count += 1

        return deleted_count

    async def _hgetall(self, key: str) -> Dict[str, Any]:
        """Get all fields and values from a hash."""
        return self._hashes.get(key, {}).copy()

    # Other operations
    async def _scan(
        self, cursor: int = 0, match: Optional[str] = None, count: int = 10
    ) -> Tuple[int, List[str]]:
        """Scan keys matching a pattern."""
        # Simple implementation that ignores cursor for testing
        all_keys = list(self._storage.keys())

        # Filter by pattern if provided
        if match and "*" in match:
            import fnmatch

            filtered_keys = [k for k in all_keys if fnmatch.fnmatch(k, match)]
        else:
            filtered_keys = all_keys

        # Return the first 'count' items and a cursor
        return (0, filtered_keys[:count])

    # Pipeline operations
    def _add_pipeline_command(self, command: str, *args: Any, **kwargs: Any) -> "MockRedisClient":
        """Add a command to the pipeline."""
        self._pipeline_commands.append((command, args, kwargs))
        return self

    async def _execute_pipeline(self) -> List[Any]:
        """Execute all commands in the pipeline."""
        results = []
        for command, args, kwargs in self._pipeline_commands:
            method = getattr(self, f"_{command}")
            result = await method(*args, **kwargs)
            results.append(result)

        # Clear the pipeline
        self._pipeline_commands = []
        return results


@pytest_asyncio.fixture(scope="function")
async def enhanced_redis_mock() -> AsyncGenerator[MockRedisClient, None]:
    """Provide an enhanced Redis mock with state tracking for tests."""
    mock = MockRedisClient()
    yield mock
