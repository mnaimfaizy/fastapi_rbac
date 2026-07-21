"""
Service mocks for testing.

This module provides mock implementations of service dependencies
such as Redis clients, email services, etc.
"""

from test.fixtures.mock_redis_client import MockRedisClient
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

__all__ = ["MockRedisClient", "enhanced_redis_mock", "mock_send_email"]


@pytest_asyncio.fixture(scope="function")
async def enhanced_redis_mock() -> AsyncGenerator[MockRedisClient, None]:
    """Provide an enhanced Redis mock with state tracking for tests."""
    mock = MockRedisClient()
    yield mock


@pytest.fixture(autouse=True)
def mock_send_email() -> Generator[MagicMock | AsyncMock, None, None]:
    """Automatically mock the send_email function in all tests to prevent real email sending."""
    with patch("app.utils.email.email.send_email") as mock:
        mock.return_value = True
        yield mock
