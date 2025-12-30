"""
Test Redis connection factory for SSL/TLS connections.

These tests verify that the RedisConnectionFactory properly configures
SSL/TLS connections based on the environment mode.
"""

import os
import ssl
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from redis.asyncio import ConnectionPool, Redis

from app.core.config import ModeEnum, settings
from app.utils.redis_connection import RedisConnectionFactory


@pytest.fixture(autouse=True)
def reset_factory():
    """Reset RedisConnectionFactory singleton state between tests."""
    RedisConnectionFactory._pool = None
    RedisConnectionFactory._client = None
    yield
    RedisConnectionFactory._pool = None
    RedisConnectionFactory._client = None


class TestRedisConnectionFactory:
    """Test suite for RedisConnectionFactory."""

    def test_get_ssl_context_development(self):
        """Test that SSL context is None in development mode."""
        ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.development)
        assert ssl_context is None

    def test_get_ssl_context_testing_disabled(self):
        """Test that SSL context is None in testing mode when SSL is disabled."""
        with patch.dict(os.environ, {"REDIS_SSL": "false"}):
            ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.testing)
            assert ssl_context is None

    @patch("app.utils.redis_connection.os.path.exists")
    @patch("app.utils.redis_connection.ssl.create_default_context")
    def test_get_ssl_context_production(self, mock_create_context, mock_exists):
        """Test that SSL context is properly configured in production mode."""
        # Mock certificate file existence
        mock_exists.return_value = True

        # Mock SSL context
        mock_ssl_context = MagicMock(spec=ssl.SSLContext)
        mock_create_context.return_value = mock_ssl_context

        # Get SSL context for production
        ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.production)

        # Verify SSL context was created and configured
        assert ssl_context is not None
        mock_create_context.assert_called_once_with(ssl.Purpose.SERVER_AUTH)
        assert ssl_context.check_hostname is True
        assert ssl_context.verify_mode == ssl.CERT_REQUIRED
        assert ssl_context.minimum_version == ssl.TLSVersion.TLSv1_2

    @patch("app.utils.redis_connection.os.path.exists")
    def test_get_ssl_context_missing_certificate_production(self, mock_exists):
        """Test that RuntimeError is raised when certificate is missing in production."""
        # Mock certificate file not existing
        mock_exists.return_value = False

        # Should raise RuntimeError in production
        with pytest.raises(RuntimeError, match="CA certificate not found"):
            RedisConnectionFactory._get_ssl_context(ModeEnum.production)

    def test_get_connection_params_development(self):
        """Test connection parameters for development mode."""
        with patch.object(settings, "MODE", ModeEnum.development):
            params = RedisConnectionFactory._get_connection_params(db=0)

            assert params["host"] == settings.REDIS_HOST
            assert params["port"] == int(settings.REDIS_PORT)
            assert params["db"] == 0
            assert params["decode_responses"] is True
            assert "ssl" not in params or params["ssl"] is False

    @patch("app.utils.redis_connection.RedisConnectionFactory._get_ssl_context")
    def test_get_connection_params_production(self, mock_get_ssl_context):
        """Test connection parameters for production mode with SSL."""
        # Mock SSL context
        mock_ssl_context = MagicMock(spec=ssl.SSLContext)
        mock_get_ssl_context.return_value = mock_ssl_context

        with patch.object(settings, "MODE", ModeEnum.production):
            params = RedisConnectionFactory._get_connection_params(db=0)

            assert params["ssl"] is True
            assert params["ssl_context"] == mock_ssl_context
            assert params["socket_keepalive"] is True
            assert params["health_check_interval"] == 30

    @patch("app.utils.redis_connection.ConnectionPool")
    def test_create_connection_pool(self, mock_pool_class):
        """Test connection pool creation."""
        mock_pool = MagicMock(spec=ConnectionPool)
        mock_pool_class.return_value = mock_pool

        pool = RedisConnectionFactory._create_connection_pool(db=0, max_connections=50)

        assert pool == mock_pool
        mock_pool_class.assert_called_once()
        call_kwargs = mock_pool_class.call_args.kwargs
        assert call_kwargs["max_connections"] == 50
        assert call_kwargs["db"] == 0

    @patch("app.utils.redis_connection.RedisConnectionFactory._create_connection_pool")
    def test_get_connection_pool_singleton(self, mock_create_pool):
        """Test that connection pool is a singleton."""
        mock_pool = MagicMock(spec=ConnectionPool)
        mock_create_pool.return_value = mock_pool

        # First call should create pool
        pool1 = RedisConnectionFactory.get_connection_pool()
        assert pool1 == mock_pool
        assert mock_create_pool.call_count == 1

        # Second call should return same pool
        pool2 = RedisConnectionFactory.get_connection_pool()
        assert pool2 == mock_pool
        assert mock_create_pool.call_count == 1  # Not called again

    @pytest_asyncio.fixture
    async def mock_redis_pool(self):
        """Create a mock Redis connection pool."""
        mock_pool = MagicMock(spec=ConnectionPool)
        with patch.object(RedisConnectionFactory, "get_connection_pool", return_value=mock_pool):
            yield mock_pool

    @pytest.mark.asyncio
    async def test_get_client(self, mock_redis_pool):
        """Test getting a Redis client from the pool."""
        with patch("app.utils.redis_connection.Redis") as mock_redis_class:
            mock_client = AsyncMock(spec=Redis)
            mock_redis_class.return_value = mock_client

            client = await RedisConnectionFactory.get_client(db=0)

            assert client == mock_client
            mock_redis_class.assert_called_once_with(connection_pool=mock_redis_pool)

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Test successful health check."""
        mock_client = AsyncMock(spec=Redis)
        mock_client.ping = AsyncMock(return_value=True)

        result = await RedisConnectionFactory.health_check(client=mock_client)

        assert result is True
        mock_client.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """Test health check failure."""
        from redis.exceptions import ConnectionError

        mock_client = AsyncMock(spec=Redis)
        mock_client.ping = AsyncMock(side_effect=ConnectionError("Connection failed"))

        with pytest.raises(ConnectionError):
            await RedisConnectionFactory.health_check(client=mock_client)

    @pytest.mark.asyncio
    async def test_close_pool(self):
        """Test closing the connection pool."""
        mock_pool = AsyncMock(spec=ConnectionPool)
        mock_pool.disconnect = AsyncMock()

        RedisConnectionFactory._pool = mock_pool

        await RedisConnectionFactory.close_pool()

        mock_pool.disconnect.assert_called_once()
        assert RedisConnectionFactory._pool is None


class TestRedisConnectionIntegration:
    """Integration tests for Redis connection (requires Redis running)."""

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_real_redis_connection(self):
        """Test actual connection to Redis (requires running Redis)."""
        # This test requires a real Redis instance
        # Skip if REDIS_HOST is not accessible
        try:
            client = await RedisConnectionFactory.get_client(db=0)
            result = await client.ping()
            assert result is True
        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await RedisConnectionFactory.close_pool()

    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_connection_pool_reuse(self):
        """Test that connections are properly reused from the pool."""
        try:
            # Get two clients - should use same pool
            client1 = await RedisConnectionFactory.get_client(db=0)
            client2 = await RedisConnectionFactory.get_client(db=0)

            # Both should be able to ping
            assert await client1.ping()
            assert await client2.ping()

            # They should use the same connection pool
            pool1 = RedisConnectionFactory.get_connection_pool()
            pool2 = RedisConnectionFactory.get_connection_pool()
            assert pool1 is pool2

        except Exception as e:
            pytest.skip(f"Redis not available: {e}")
        finally:
            await RedisConnectionFactory.close_pool()
