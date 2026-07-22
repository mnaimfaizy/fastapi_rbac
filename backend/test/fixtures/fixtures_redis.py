"""
Redis-related test fixtures.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from typing import AsyncGenerator

import pytest_asyncio


@pytest_asyncio.fixture(scope="function")
async def redis_mock() -> AsyncGenerator[MockRedisClient, None]:
    """Provide a stateful Redis mock so JWT allowlist sets work in tests (#73)."""
    yield MockRedisClient()
