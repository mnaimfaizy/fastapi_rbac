"""Stateful Redis mock used by test fixtures (not a pytest plugin module)."""

from typing import Any, Dict, List, Optional, Set, Tuple
from unittest.mock import AsyncMock


class MockRedisClient:
    """Enhanced Redis mock implementation for testing."""

    def __init__(self) -> None:
        """Initialize with storage dictionaries to simulate Redis state."""
        self._storage: Dict[str, Any] = {}
        self._sets: Dict[str, Set[Any]] = {}
        self._hashes: Dict[str, Dict[str, Any]] = {}
        self._expirations: Dict[str, int] = {}

        self.get = AsyncMock(side_effect=self._get)
        self.set = AsyncMock(side_effect=self._set)
        self.delete = AsyncMock(side_effect=self._delete)
        self.exists = AsyncMock(side_effect=self._exists)
        self.expire = AsyncMock(side_effect=self._expire)

        self.sadd = AsyncMock(side_effect=self._sadd)
        self.srem = AsyncMock(side_effect=self._srem)
        self.smembers = AsyncMock(side_effect=self._smembers)
        self.sismember = AsyncMock(side_effect=self._sismember)

        self.hget = AsyncMock(side_effect=self._hget)
        self.hset = AsyncMock(side_effect=self._hset)
        self.hdel = AsyncMock(side_effect=self._hdel)
        self.hgetall = AsyncMock(side_effect=self._hgetall)

        self.scan = AsyncMock(side_effect=self._scan)

        self.pipeline = AsyncMock(return_value=self)
        self.execute = AsyncMock(side_effect=self._execute_pipeline)

        self._pipeline_commands: List[Tuple[str, tuple, dict]] = []

    async def _get(self, key: str) -> Any:
        return self._storage.get(key)

    async def _set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        self._storage[key] = value
        if ex is not None:
            self._expirations[key] = ex
        return True

    async def _delete(self, key: str) -> int:
        """Delete a key from string, set, or hash storage."""
        deleted = 0
        if key in self._storage:
            del self._storage[key]
            deleted = 1
        if key in self._sets:
            del self._sets[key]
            deleted = 1
        if key in self._hashes:
            del self._hashes[key]
            deleted = 1
        if key in self._expirations:
            del self._expirations[key]
        return deleted

    async def _exists(self, key: str) -> bool:
        return key in self._storage or key in self._sets or key in self._hashes

    async def _expire(self, key: str, seconds: int | object) -> bool:
        """Set expiration for a key (accepts seconds or timedelta-like values)."""
        if not await self._exists(key):
            return False
        if hasattr(seconds, "total_seconds"):
            self._expirations[key] = int(seconds.total_seconds())  # type: ignore[union-attr]
        else:
            self._expirations[key] = int(seconds)  # type: ignore[arg-type]
        return True

    async def _sadd(self, key: str, *values: Any) -> int:
        if key not in self._sets:
            self._sets[key] = set()

        added_count = 0
        for value in values:
            if value not in self._sets[key]:
                self._sets[key].add(value)
                added_count += 1

        return added_count

    async def _srem(self, key: str, *values: Any) -> int:
        if key not in self._sets:
            return 0

        removed_count = 0
        for value in values:
            if value in self._sets[key]:
                self._sets[key].remove(value)
                removed_count += 1

        return removed_count

    async def _smembers(self, key: str) -> Set[Any]:
        return self._sets.get(key, set()).copy()

    async def _sismember(self, key: str, value: Any) -> bool:
        if key not in self._sets:
            return False
        return value in self._sets[key]

    async def _hget(self, key: str, field: str) -> Any:
        if key not in self._hashes:
            return None
        return self._hashes[key].get(field)

    async def _hset(self, key: str, field: str, value: Any) -> int:
        if key not in self._hashes:
            self._hashes[key] = {}

        is_new = field not in self._hashes[key]
        self._hashes[key][field] = value
        return 1 if is_new else 0

    async def _hdel(self, key: str, *fields: str) -> int:
        if key not in self._hashes:
            return 0

        deleted_count = 0
        for field in fields:
            if field in self._hashes[key]:
                del self._hashes[key][field]
                deleted_count += 1

        return deleted_count

    async def _hgetall(self, key: str) -> Dict[str, Any]:
        return self._hashes.get(key, {}).copy()

    async def _scan(
        self, cursor: int = 0, match: Optional[str] = None, count: int = 10
    ) -> Tuple[int, List[str]]:
        all_keys = list(self._storage.keys()) + list(self._sets.keys()) + list(self._hashes.keys())

        if match and "*" in match:
            import fnmatch

            filtered_keys = [k for k in all_keys if fnmatch.fnmatch(k, match)]
        else:
            filtered_keys = all_keys

        return (0, filtered_keys[:count])

    def _add_pipeline_command(self, command: str, *args: Any, **kwargs: Any) -> "MockRedisClient":
        self._pipeline_commands.append((command, args, kwargs))
        return self

    async def _execute_pipeline(self) -> List[Any]:
        results = []
        for command, args, kwargs in self._pipeline_commands:
            method = getattr(self, f"_{command}")
            result = await method(*args, **kwargs)
            results.append(result)

        self._pipeline_commands = []
        return results
