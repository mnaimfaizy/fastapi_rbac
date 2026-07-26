"""
Enhanced Redis connection management with SSL support for production.

This module provides a centralized, secure, and resilient way to manage
Redis connections across the FastAPI RBAC application, with special
attention to production SSL/TLS requirements.

Features:
- Automatic SSL/TLS configuration based on environment
- Connection pooling with configurable parameters
- Retry logic with exponential backoff
- Comprehensive error handling and logging
- Certificate validation for production
- Health check capabilities
"""

import logging
import os
import socket
import ssl
from typing import Any, Dict, Optional

import redis.asyncio as aioredis
from redis.asyncio import ConnectionPool, Redis
from redis.asyncio.retry import Retry
from redis.backoff import ExponentialBackoff
from redis.exceptions import (
    AuthenticationError,
    ConnectionError,
    RedisError,
    TimeoutError,
)
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import ModeEnum, settings

logger = logging.getLogger(__name__)


class RedisConnectionFactory:
    """
    Factory class for creating and managing Redis connections with SSL support.

    This factory handles the complexity of SSL configuration, connection pooling,
    and resilience patterns for Redis connections in different environments.
    """

    _pool: Optional[ConnectionPool] = None
    _client: Optional[Redis] = None

    @classmethod
    def _is_ssl_enabled(cls, mode: ModeEnum) -> bool:
        """Return whether Redis TLS should be used for the given mode."""
        if mode == ModeEnum.development:
            return False
        if mode == ModeEnum.testing:
            return os.getenv("REDIS_SSL", "false").lower() == "true"
        # Production defaults to TLS (self-hosted Redis); set REDIS_SSL=false for
        # plain Compose Redis on the one-box Hub runtime.
        return os.getenv("REDIS_SSL", "true").lower() == "true"

    @classmethod
    def _get_cert_dir(cls) -> str:
        """Resolve the directory that holds Redis TLS materials."""
        cert_path = os.getenv("REDIS_CERT_PATH", "/app/certs")
        if not os.path.exists(cert_path):
            # Fallback to local certs directory for development containers
            cert_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs")
            logger.info(f"Using fallback certificate path: {cert_path}")
        return cert_path

    @classmethod
    def _get_ssl_connection_kwargs(cls, mode: ModeEnum) -> Optional[Dict[str, Any]]:
        """
        Build kwargs for redis.asyncio.SSLConnection.

        redis-py asyncio does not accept a boolean ``ssl=`` kwarg on Connection;
        TLS requires ``SSLConnection`` plus ``ssl_ca_certs`` / related fields.
        """
        if not cls._is_ssl_enabled(mode):
            if mode == ModeEnum.development:
                logger.info("Development mode: SSL disabled for Redis")
            elif mode == ModeEnum.testing:
                logger.info("Testing mode: SSL disabled for Redis")
            else:
                logger.info("Production mode: REDIS_SSL disabled for Redis")
            return None

        cert_path = cls._get_cert_dir()
        ca_cert_path = os.path.join(cert_path, "ca.crt")

        if not os.path.exists(ca_cert_path):
            error_msg = (
                f"Redis SSL is enabled but CA certificate not found at {ca_cert_path}. "
                "Generate certificates using backend/certs/generate-certs.sh "
                "or mount a CA bundle at that path for managed Redis (e.g. Upstash)."
            )
            if mode == ModeEnum.production:
                logger.error(error_msg)
                raise RuntimeError(error_msg)
            logger.warning(error_msg)
            return None

        logger.info(f"Loaded CA certificate from {ca_cert_path}")

        check_hostname = True
        if mode == ModeEnum.testing:
            check_hostname = os.getenv("REDIS_SSL_CHECK_HOSTNAME", "false").lower() == "true"
            logger.info(f"Testing mode: SSL hostname verification = {check_hostname}")

        kwargs: Dict[str, Any] = {
            "ssl_ca_certs": ca_cert_path,
            "ssl_cert_reqs": "required",
            "ssl_check_hostname": check_hostname,
            "ssl_min_version": ssl.TLSVersion.TLSv1_2,
        }

        # Optional mTLS client certificates (self-hosted Redis); managed Redis
        # such as Upstash typically only needs the CA / system trust store.
        certfile = os.path.join(cert_path, "redis.crt")
        keyfile = os.path.join(cert_path, "redis.key")
        if os.path.exists(certfile) and os.path.exists(keyfile):
            kwargs["ssl_certfile"] = certfile
            kwargs["ssl_keyfile"] = keyfile

        logger.info("SSL configured for Redis with certificate validation")
        return kwargs

    @classmethod
    def _get_ssl_context(cls, mode: ModeEnum) -> Optional[ssl.SSLContext]:
        """
        Create and configure SSL context for Redis connections.

        Retained for callers/tests that need an ``ssl.SSLContext``. Runtime
        pooling uses :meth:`_get_ssl_connection_kwargs` with ``SSLConnection``.
        """
        ssl_kwargs = cls._get_ssl_connection_kwargs(mode)
        if not ssl_kwargs:
            return None

        ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        ssl_context.load_verify_locations(cafile=ssl_kwargs["ssl_ca_certs"])
        ssl_context.check_hostname = bool(ssl_kwargs.get("ssl_check_hostname", True))
        ssl_context.verify_mode = ssl.CERT_REQUIRED
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
        ssl_context.maximum_version = ssl.TLSVersion.TLSv1_3
        ssl_context.set_ciphers("ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS")
        logger.info("SSL context configured for Redis with certificate validation")
        return ssl_context

    @classmethod
    def _get_connection_params(cls, db: int = 0) -> Dict[str, Any]:
        """
        Build Redis connection parameters based on environment.

        Args:
            db: Redis database number (default: 0)

        Returns:
            Dictionary of connection parameters for redis-py
        """
        mode = settings.MODE
        redis_host = settings.REDIS_HOST
        redis_port = int(settings.REDIS_PORT) if settings.REDIS_PORT else 6379
        redis_password = settings.REDIS_PASSWORD

        # Base connection parameters
        # Use real socket constants (Linux: TCP_KEEPIDLE=4, etc.). The previous
        # hard-coded 1/2/3 mapped to TCP_NODELAY/TCP_MAXSEG/TCP_CORK and caused
        # OSError EINVAL when redis-py applied them under uvloop.
        keepalive_options: Dict[int, int] = {}
        if hasattr(socket, "TCP_KEEPIDLE"):
            keepalive_options[socket.TCP_KEEPIDLE] = 60
        if hasattr(socket, "TCP_KEEPINTVL"):
            keepalive_options[socket.TCP_KEEPINTVL] = 10
        if hasattr(socket, "TCP_KEEPCNT"):
            keepalive_options[socket.TCP_KEEPCNT] = 3

        params: Dict[str, Any] = {
            "host": redis_host,
            "port": redis_port,
            "db": db,
            "decode_responses": True,
            "encoding": "utf-8",
            "socket_keepalive": True,
            "health_check_interval": 30,  # Check connection health every 30 seconds
        }
        if keepalive_options:
            params["socket_keepalive_options"] = keepalive_options

        # Add authentication if password is set
        if redis_password:
            params["password"] = redis_password
            params["username"] = "default"  # Redis 6+ ACL username

        ssl_kwargs = cls._get_ssl_connection_kwargs(mode)
        if ssl_kwargs:
            params.update(ssl_kwargs)
            params["_use_ssl"] = True

        # Connection timeout settings
        params["socket_connect_timeout"] = 5  # 5 seconds for initial connection
        params["socket_timeout"] = 5  # 5 seconds for operations

        # Retry configuration
        retry_policy = Retry(ExponentialBackoff(base=0.1, cap=2.0), retries=3)
        params["retry"] = retry_policy
        params["retry_on_timeout"] = True
        params["retry_on_error"] = [ConnectionError, TimeoutError]

        return params

    @classmethod
    def _create_connection_pool(cls, db: int = 0, max_connections: int = 50) -> ConnectionPool:
        """
        Create a connection pool for Redis.

        Args:
            db: Redis database number
            max_connections: Maximum number of connections in the pool

        Returns:
            Configured ConnectionPool instance
        """
        params = cls._get_connection_params(db)
        use_ssl = bool(params.pop("_use_ssl", False))
        connection_class = aioredis.SSLConnection if use_ssl else aioredis.Connection

        # Add pooling-specific parameters
        pool_params = {
            **params,
            "max_connections": max_connections,
            "connection_class": connection_class,
        }

        logger.info(
            f"Creating Redis connection pool for {params['host']}:{params['port']}, "
            f"db={db}, max_connections={max_connections}, ssl={use_ssl}"
        )

        return ConnectionPool(**pool_params)

    @classmethod
    def get_connection_pool(cls, db: int = 0, max_connections: int = 50) -> ConnectionPool:
        """
        Get or create a singleton connection pool.

        Args:
            db: Redis database number
            max_connections: Maximum number of connections in the pool

        Returns:
            ConnectionPool instance
        """
        if cls._pool is None:
            cls._pool = cls._create_connection_pool(db=db, max_connections=max_connections)
        return cls._pool

    @classmethod
    async def get_client(cls, db: int = 0) -> Redis:
        """
        Get a Redis client using the connection pool.

        Args:
            db: Redis database number

        Returns:
            Redis client instance

        Raises:
            RedisError: If connection to Redis fails
        """
        pool = cls.get_connection_pool(db=db)
        return Redis(connection_pool=pool)

    @classmethod
    @retry(
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def health_check(cls, client: Optional[Redis] = None) -> bool:
        """
        Perform a health check on Redis connection.

        Args:
            client: Optional Redis client to check (creates new one if not provided)

        Returns:
            True if Redis is healthy, False otherwise

        Raises:
            RedisError: If health check fails after retries
        """
        should_close = False
        if client is None:
            client = await cls.get_client()
            should_close = True

        try:
            response = await client.ping()
            if response:
                logger.info("Redis health check: OK")
                return True
            else:
                logger.warning("Redis health check: Failed (no response)")
                return False
        except AuthenticationError as e:
            logger.error(f"Redis health check failed: Authentication error - {e}")
            raise
        except (ConnectionError, TimeoutError) as e:
            logger.error(f"Redis health check failed: Connection error - {e}")
            raise
        except RedisError as e:
            logger.error(f"Redis health check failed: {e}")
            raise
        finally:
            if should_close and client:
                await client.close()

    @classmethod
    async def close_pool(cls) -> None:
        """
        Close the connection pool and cleanup resources.
        """
        if cls._pool is not None:
            await cls._pool.disconnect()
            cls._pool = None
            logger.info("Redis connection pool closed")

        if cls._client is not None:
            await cls._client.close()
            cls._client = None


# Convenience functions for backward compatibility
async def get_redis_client(db: int = 0) -> Redis:
    """
    Get a Redis client instance.

    Args:
        db: Redis database number (default: 0)

    Returns:
        Redis client instance
    """
    return await RedisConnectionFactory.get_client(db=db)


async def close_redis_pool() -> None:
    """
    Close the Redis connection pool.
    """
    await RedisConnectionFactory.close_pool()
