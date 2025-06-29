"""
FastAPI app test fixtures.
"""

import os
from typing import Any, AsyncGenerator, Callable
from unittest.mock import AsyncMock

import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import get_db, get_redis_client
from app.main import fastapi_app as main_app


@pytest_asyncio.fixture(scope="function")
async def app(db: AsyncSession, redis_mock: AsyncMock) -> FastAPI:
    """Return a FastAPI app instance with test dependencies."""

    # Override the get_db dependency
    async def get_test_db() -> AsyncGenerator[AsyncSession, None]:
        try:
            yield db
        finally:
            pass

    # Override the get_redis dependency
    async def get_test_redis() -> AsyncGenerator[AsyncMock, None]:
        yield redis_mock

    # Override the dependencies
    main_app.dependency_overrides[get_db] = get_test_db
    main_app.dependency_overrides[get_redis_client] = get_test_redis

    return main_app


@pytest_asyncio.fixture(scope="function")
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    """Return a test client for the FastAPI app."""
    from app.api.deps import get_current_user

    def mock_get_current_user(*args: Any, **kwargs: Any) -> Callable[..., Any]:
        """Mock the get_current_user dependency"""

        async def get_current_user() -> None:
            return None

        return get_current_user

    # Override the get_current_user function
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # Use real HTTP client if running in Docker Compose integration mode
    use_http = os.getenv("USE_HTTP_TEST_CLIENT", "0") == "1" or os.getenv("TEST_API_BASE_URL")
    if use_http:
        base_url = os.getenv("TEST_API_BASE_URL", "http://fastapi_rbac_test:8000")
        async with AsyncClient(base_url=base_url) as test_client:
            yield test_client
    else:
        # Use in-process ASGI client for local test runs
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as test_client:
            yield test_client

    # Clear dependency overrides
    app.dependency_overrides = {}
