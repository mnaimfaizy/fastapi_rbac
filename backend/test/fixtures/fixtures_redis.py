"""
Redis-related test fixtures.
"""

from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest_asyncio


@pytest_asyncio.fixture(scope="function")
async def redis_mock() -> AsyncGenerator[AsyncMock, None]:
    """Provide a Redis mock for tests."""
    mock = AsyncMock()

    # Setup common mock methods
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    mock.delete = AsyncMock(return_value=True)
    mock.exists = AsyncMock(return_value=False)
    mock.sadd = AsyncMock(return_value=True)
    mock.smembers = AsyncMock(return_value=set())
    mock.expire = AsyncMock(return_value=True)

    # Token validation and management methods
    mock.sismember = AsyncMock(return_value=False)
    mock.srem = AsyncMock(return_value=True)
    mock.scan = AsyncMock(return_value=(0, []))
    mock.pipeline = AsyncMock(return_value=mock)
    mock.execute = AsyncMock(return_value=[])

    yield mock
