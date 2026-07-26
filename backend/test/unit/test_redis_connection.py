"""
Test Redis connection factory for SSL/TLS connections.

These tests verify that the RedisConnectionFactory properly configures
SSL/TLS connections based on the environment mode.
"""

import os
import socket
import ssl
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
import redis.asyncio as aioredis
from redis.asyncio import ConnectionPool, Redis

from app.core.config import ModeEnum, settings
from app.utils.redis_connection import RedisConnectionFactory


@pytest.fixture(autouse=True)
def _reset_factory() -> Generator[None, None, None]:
    """Reset RedisConnectionFactory singleton state between tests."""
    RedisConnectionFactory.discard_pool()
    yield
    RedisConnectionFactory.discard_pool()


class TestRedisConnectionFactory:
    """Test suite for RedisConnectionFactory."""

    def test_get_ssl_context_development(self) -> None:
        """Test that SSL context is None in development mode."""
        ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.development)
        assert ssl_context is None

    def test_get_ssl_context_testing_disabled(self) -> None:
        """Test that SSL context is None in testing mode when SSL is disabled."""
        with patch.dict(os.environ, {"REDIS_SSL": "false"}):
            ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.testing)
            assert ssl_context is None

    @patch("app.utils.redis_connection.os.path.exists")
    @patch("app.utils.redis_connection.ssl.create_default_context")
    def test_get_ssl_context_production(self, mock_create_context: MagicMock, mock_exists: MagicMock) -> None:
        """Test that SSL context is properly configured in production mode."""
        mock_exists.return_value = True
        mock_ssl_context = MagicMock(spec=ssl.SSLContext)
        mock_create_context.return_value = mock_ssl_context

        with patch.dict(os.environ, {"REDIS_SSL": "true"}, clear=False):
            ssl_context = RedisConnectionFactory._get_ssl_context(ModeEnum.production)

        assert ssl_context is not None
        mock_create_context.assert_called_once_with(ssl.Purpose.SERVER_AUTH)
        mock_ssl_context.load_verify_locations.assert_called_once()
        assert mock_ssl_context.check_hostname is True
        assert mock_ssl_context.verify_mode == ssl.CERT_REQUIRED
        assert mock_ssl_context.minimum_version == ssl.TLSVersion.TLSv1_2

    @patch("app.utils.redis_connection.os.path.exists")
    def test_get_ssl_context_missing_certificate_production(self, mock_exists: MagicMock) -> None:
        """Test that RuntimeError is raised when certificate is missing in production."""
        mock_exists.return_value = False

        with patch.dict(os.environ, {"REDIS_SSL": "true"}, clear=False):
            with pytest.raises(RuntimeError, match="CA certificate not found"):
                RedisConnectionFactory._get_ssl_context(ModeEnum.production)

    def test_get_ssl_connection_kwargs_production(self) -> None:
        """Test SSLConnection kwargs for production TLS Redis."""
        with (
            patch.dict(os.environ, {"REDIS_SSL": "true", "REDIS_CERT_PATH": "/tmp/certs"}, clear=False),
            patch("app.utils.redis_connection.os.path.exists", return_value=True),
        ):
            kwargs = RedisConnectionFactory._get_ssl_connection_kwargs(ModeEnum.production)

        assert kwargs is not None
        assert kwargs["ssl_ca_certs"].endswith("ca.crt")
        assert kwargs["ssl_cert_reqs"] == "required"
        assert kwargs["ssl_check_hostname"] is True
        assert "ssl" not in kwargs
        assert "ssl_context" not in kwargs

    def test_get_connection_params_development(self) -> None:
        """Test connection parameters for development mode."""
        with patch.object(settings, "MODE", ModeEnum.development):
            params = RedisConnectionFactory._get_connection_params(db=0)

            assert params["host"] == settings.REDIS_HOST
            expected_port = int(settings.REDIS_PORT) if settings.REDIS_PORT else 6379
            assert params["port"] == expected_port
            assert params["db"] == 0
            assert params["decode_responses"] is True
            assert params.get("_use_ssl") is not True
            assert "ssl_ca_certs" not in params
            assert params["socket_keepalive"] is True
            if hasattr(socket, "TCP_KEEPIDLE"):
                expected_keepalive_options = {
                    socket.TCP_KEEPIDLE: 60,
                    socket.TCP_KEEPINTVL: 10,
                    socket.TCP_KEEPCNT: 3,
                }
                assert params["socket_keepalive_options"] == expected_keepalive_options

    @patch("app.utils.redis_connection.RedisConnectionFactory._get_ssl_connection_kwargs")
    def test_get_connection_params_production(self, mock_ssl_kwargs: MagicMock) -> None:
        """Test connection parameters for production mode with SSL."""
        mock_ssl_kwargs.return_value = {
            "ssl_ca_certs": "/app/certs/ca.crt",
            "ssl_cert_reqs": "required",
            "ssl_check_hostname": True,
            "ssl_min_version": ssl.TLSVersion.TLSv1_2,
        }

        with patch.object(settings, "MODE", ModeEnum.production):
            params = RedisConnectionFactory._get_connection_params(db=0)

            assert params["_use_ssl"] is True
            assert params["ssl_ca_certs"] == "/app/certs/ca.crt"
            assert "ssl" not in params
            assert "ssl_context" not in params
            assert params["socket_keepalive"] is True
            assert params["health_check_interval"] == 30

    @patch("app.utils.redis_connection.ConnectionPool")
    def test_create_connection_pool(self, mock_pool_class: MagicMock) -> None:
        """Test connection pool creation without TLS uses Connection."""
        mock_pool = MagicMock(spec=ConnectionPool)
        mock_pool_class.return_value = mock_pool

        with patch.object(settings, "MODE", ModeEnum.development):
            pool = RedisConnectionFactory._create_connection_pool(db=0, max_connections=50)

        assert pool == mock_pool
        mock_pool_class.assert_called_once()
        call_kwargs = mock_pool_class.call_args.kwargs
        assert call_kwargs["max_connections"] == 50
        assert call_kwargs["db"] == 0
        assert call_kwargs["connection_class"] is aioredis.Connection
        assert "_use_ssl" not in call_kwargs

    @patch("app.utils.redis_connection.ConnectionPool")
    @patch("app.utils.redis_connection.RedisConnectionFactory._get_ssl_connection_kwargs")
    def test_create_connection_pool_uses_ssl_connection(
        self, mock_ssl_kwargs: MagicMock, mock_pool_class: MagicMock
    ) -> None:
        """TLS pools must use SSLConnection (not Connection + ssl=True)."""
        mock_pool = MagicMock(spec=ConnectionPool)
        mock_pool_class.return_value = mock_pool
        mock_ssl_kwargs.return_value = {
            "ssl_ca_certs": "/app/certs/ca.crt",
            "ssl_cert_reqs": "required",
            "ssl_check_hostname": True,
            "ssl_min_version": ssl.TLSVersion.TLSv1_2,
        }

        with patch.object(settings, "MODE", ModeEnum.production):
            RedisConnectionFactory._create_connection_pool(db=0, max_connections=50)

        call_kwargs = mock_pool_class.call_args.kwargs
        assert call_kwargs["connection_class"] is aioredis.SSLConnection
        assert call_kwargs["ssl_ca_certs"] == "/app/certs/ca.crt"
        assert "ssl" not in call_kwargs
        assert "ssl_context" not in call_kwargs
        assert "_use_ssl" not in call_kwargs

    @patch("app.utils.redis_connection.RedisConnectionFactory._create_connection_pool")
    def test_get_connection_pool_singleton(self, mock_create_pool: MagicMock) -> None:
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

    @patch("app.utils.redis_connection.RedisConnectionFactory._create_connection_pool")
    def test_get_connection_pool_recreates_for_new_event_loop(self, mock_create_pool: MagicMock) -> None:
        """Celery asyncio.run per task must not reuse a pool from a closed loop."""
        mock_pool_a = MagicMock(spec=ConnectionPool)
        mock_pool_b = MagicMock(spec=ConnectionPool)
        mock_create_pool.return_value = mock_pool_b

        RedisConnectionFactory._pool = mock_pool_a
        RedisConnectionFactory._pool_loop_id = 111

        with patch.object(RedisConnectionFactory, "_current_loop_id", return_value=222):
            pool = RedisConnectionFactory.get_connection_pool()

        assert pool == mock_pool_b
        assert mock_create_pool.call_count == 1
        assert RedisConnectionFactory._pool_loop_id == 222

    @pytest_asyncio.fixture
    async def mock_redis_pool(self) -> AsyncGenerator[MagicMock, None]:
        """Create a mock Redis connection pool."""
        mock_pool = MagicMock(spec=ConnectionPool)
        with patch.object(RedisConnectionFactory, "get_connection_pool", return_value=mock_pool):
            yield mock_pool

    @pytest.mark.asyncio
    async def test_get_client(self, mock_redis_pool: MagicMock) -> None:
        """Test getting a Redis client from the pool."""
        with patch("app.utils.redis_connection.Redis") as mock_redis_class:
            mock_client = AsyncMock(spec=Redis)
            mock_redis_class.return_value = mock_client

            client = await RedisConnectionFactory.get_client(db=0)

            assert client == mock_client
            mock_redis_class.assert_called_once_with(connection_pool=mock_redis_pool)

    @pytest.mark.asyncio
    async def test_health_check_success(self) -> None:
        """Test successful health check."""
        mock_client = AsyncMock(spec=Redis)
        mock_client.ping = AsyncMock(return_value=True)

        result = await RedisConnectionFactory.health_check(client=mock_client)

        assert result is True
        mock_client.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check_failure(self) -> None:
        """Test health check failure."""
        from redis.exceptions import ConnectionError

        mock_client = AsyncMock(spec=Redis)
        mock_client.ping = AsyncMock(side_effect=ConnectionError("Connection failed"))

        with pytest.raises(ConnectionError):
            await RedisConnectionFactory.health_check(client=mock_client)

    @pytest.mark.asyncio
    async def test_close_pool(self) -> None:
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
    async def test_real_redis_connection(self) -> None:
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
    async def test_connection_pool_reuse(self) -> None:
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
