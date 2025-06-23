"""
Enhanced mock fixtures for comprehensive testing.

This module provides pytest fixtures for all service mocks
to ensure consistent testing across integration tests.
"""

from test.mocks.celery_mock import MockCeleryApp, MockCeleryTask
from test.mocks.email_mock import MockEmailService
from test.mocks.external_api_mock import MockHTTPClient, MockOAuthProvider
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio


@pytest_asyncio.fixture(scope="function")
async def email_mock() -> AsyncGenerator[MockEmailService, None]:
    """Provide a mock email service for testing."""
    mock_service = MockEmailService()
    yield mock_service
    mock_service.clear_sent_emails()


@pytest.fixture(scope="function")
def celery_mock() -> Generator[MockCeleryApp, None, None]:
    """Provide a mock Celery application for testing."""
    mock_app = MockCeleryApp()
    yield mock_app
    mock_app.clear_calls()


@pytest.fixture(scope="function")
def celery_task_mock() -> Generator[MockCeleryTask, None, None]:
    """Provide a mock Celery task for testing."""
    mock_task = MockCeleryTask(name="test_task")
    yield mock_task
    mock_task.clear_calls()


@pytest_asyncio.fixture(scope="function")
async def http_client_mock() -> AsyncGenerator[MockHTTPClient, None]:
    """Provide a mock HTTP client for testing external API calls."""
    mock_client = MockHTTPClient()
    yield mock_client
    mock_client.clear_requests()


@pytest.fixture(scope="function")
def oauth_provider_mock() -> Generator[MockOAuthProvider, None, None]:
    """Provide a mock OAuth provider for testing OAuth flows."""
    mock_provider = MockOAuthProvider()
    yield mock_provider


@pytest_asyncio.fixture(scope="function")
async def background_tasks_mock() -> AsyncGenerator[AsyncMock, None]:
    """Provide a mock for FastAPI background tasks."""
    with patch("app.utils.background_tasks.send_verification_email") as mock_verify:
        with patch("app.utils.background_tasks.send_password_reset_email") as mock_reset:
            with patch("app.utils.background_tasks.log_security_event") as mock_log:
                with patch("app.utils.background_tasks.cleanup_expired_tokens") as mock_cleanup:
                    mock_verify.return_value = True
                    mock_reset.return_value = True
                    mock_log.return_value = True
                    mock_cleanup.return_value = True

                    yield {
                        "send_verification_email": mock_verify,
                        "send_password_reset_email": mock_reset,
                        "log_security_event": mock_log,
                        "cleanup_expired_tokens": mock_cleanup,
                    }


@pytest.fixture(scope="function")
def service_mocks() -> Generator[dict, None, None]:
    """Provide all service mocks in a single fixture."""
    email_service = MockEmailService()
    celery_app = MockCeleryApp()
    http_client = MockHTTPClient()
    oauth_provider = MockOAuthProvider()

    mocks = {
        "email": email_service,
        "celery": celery_app,
        "http_client": http_client,
        "oauth_provider": oauth_provider,
    }

    yield mocks

    # Cleanup
    email_service.clear_sent_emails()
    celery_app.clear_calls()
    http_client.clear_requests()


@pytest.fixture(scope="function")
def patched_external_services():
    """Patch all external services with mocks."""
    with (
        patch("app.utils.background_tasks.send_verification_email") as mock_verify,
        patch("app.utils.background_tasks.send_password_reset_email") as mock_reset,
        patch("app.celery_app.celery_app.send_task") as mock_celery_send,
        patch("httpx.AsyncClient") as mock_http_client,
    ):

        # Configure mocks
        mock_verify.return_value = True
        mock_reset.return_value = True
        mock_celery_send.return_value = MagicMock(task_id="mock_task_id")

        yield {
            "send_verification_email": mock_verify,
            "send_password_reset_email": mock_reset,
            "celery_send_task": mock_celery_send,
            "http_client": mock_http_client,
        }


@pytest_asyncio.fixture(scope="function")
async def comprehensive_mocks() -> AsyncGenerator[dict, None]:
    """Provide comprehensive mocks for integration testing."""
    email_service = MockEmailService()
    celery_app = MockCeleryApp()
    http_client = MockHTTPClient()

    # Patch external dependencies
    with (
        patch(
            "app.utils.background_tasks.send_verification_email",
            side_effect=email_service.send_verification_email,
        ) as mock_verify,
        patch(
            "app.utils.background_tasks.send_password_reset_email",
            side_effect=email_service.send_password_reset_email,
        ) as mock_reset,
        patch("app.celery_app.celery_app", celery_app),
    ):

        mocks = {
            "email_service": email_service,
            "celery_app": celery_app,
            "http_client": http_client,
            "patched_email_verify": mock_verify,
            "patched_email_reset": mock_reset,
        }

        yield mocks

        # Cleanup
        email_service.clear_sent_emails()
        celery_app.clear_calls()
        http_client.clear_requests()


# Helper fixtures for specific mock scenarios


@pytest.fixture(scope="function")
def email_failure_mock():
    """Mock email service that simulates failures."""
    mock_service = MockEmailService()

    async def failing_send_email(*args, **kwargs):
        raise Exception("Email service unavailable")

    mock_service.send_email = AsyncMock(side_effect=failing_send_email)
    mock_service.send_verification_email = AsyncMock(side_effect=failing_send_email)
    mock_service.send_password_reset_email = AsyncMock(side_effect=failing_send_email)

    return mock_service


@pytest.fixture(scope="function")
def slow_external_service_mock():
    """Mock external services with slow responses."""
    import asyncio

    async def slow_response(*args, **kwargs):
        await asyncio.sleep(2)  # Simulate slow response
        return True

    with (
        patch("app.utils.background_tasks.send_verification_email", side_effect=slow_response) as mock_verify,
        patch(
            "app.utils.background_tasks.send_password_reset_email", side_effect=slow_response
        ) as mock_reset,
    ):

        yield {
            "send_verification_email": mock_verify,
            "send_password_reset_email": mock_reset,
        }


@pytest.fixture(scope="function")
def redis_connection_failure_mock():
    """Mock Redis connection failures."""

    async def failing_redis_operation(*args, **kwargs):
        raise ConnectionError("Redis connection failed")

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(side_effect=failing_redis_operation)
    mock_redis.set = AsyncMock(side_effect=failing_redis_operation)
    mock_redis.delete = AsyncMock(side_effect=failing_redis_operation)

    return mock_redis


@pytest.fixture(scope="function")
def database_transaction_mock():
    """Mock database transaction scenarios."""
    from unittest.mock import Mock

    mock_session = Mock()
    mock_session.commit = AsyncMock()
    mock_session.rollback = AsyncMock()
    mock_session.close = AsyncMock()

    return mock_session
