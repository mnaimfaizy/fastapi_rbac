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
    def _get_ssl_context(cls, mode: ModeEnum) -> Optional[ssl.SSLContext]:
        """
        Create and configure SSL context for Redis connections.

        Args:
            mode: Current application mode (development, testing, production)

        Returns:
            Configured SSL context for production, None for development/testing

        Raises:
            RuntimeError: If SSL is required but certificates are missing
        """
        if mode == ModeEnum.development:
            logger.info("Development mode: SSL disabled for Redis")
            return None

        if mode == ModeEnum.testing:
            # Testing mode may use SSL depending on environment
            redis_ssl = os.getenv("REDIS_SSL", "false").lower() == "true"
            if not redis_ssl:
                logger.info("Testing mode: SSL disabled for Redis")
                return None

        # Create SSL context for production and testing (when enabled)
        ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

        # Path to certificate files
        cert_path = os.getenv("REDIS_CERT_PATH", "/app/certs")
        if not os.path.exists(cert_path):
            # Fallback to local certs directory for development containers
            cert_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs")
            logger.info(f"Using fallback certificate path: {cert_path}")

        ca_cert_path = os.path.join(cert_path, "ca.crt")

        # Verify CA certificate exists
        if not os.path.exists(ca_cert_path):
            error_msg = (
                f"Redis SSL is enabled but CA certificate not found at {ca_cert_path}. "
                "Generate certificates using backend/certs/generate-certs.sh"
            )
            if mode == ModeEnum.production:
                logger.error(error_msg)
                raise RuntimeError(error_msg)
            else:
                logger.warning(error_msg)
                return None

        # Load CA certificate
        try:
            ssl_context.load_verify_locations(cafile=ca_cert_path)
            logger.info(f"Loaded CA certificate from {ca_cert_path}")
        except Exception as e:
            error_msg = f"Failed to load CA certificate: {e}"
            if mode == ModeEnum.production:
                logger.error(error_msg)
                raise RuntimeError(error_msg)
            else:
                logger.warning(error_msg)
                return None

        # Configure SSL context for security
        ssl_context.check_hostname = True
        ssl_context.verify_mode = ssl.CERT_REQUIRED

        # Use modern TLS protocols only
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
        ssl_context.maximum_version = ssl.TLSVersion.TLSv1_3

        # Set strong cipher suites
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
        params: Dict[str, Any] = {
            "host": redis_host,
            "port": redis_port,
            "db": db,
            "decode_responses": True,
            "encoding": "utf-8",
            "socket_keepalive": True,
            "socket_keepalive_options": {
                1: 1,  # TCP_KEEPIDLE
                2: 1,  # TCP_KEEPINTVL
                3: 3,  # TCP_KEEPCNT
            },
            "health_check_interval": 30,  # Check connection health every 30 seconds
        }

        # Add authentication if password is set
        if redis_password:
            params["password"] = redis_password
            params["username"] = "default"  # Redis 6+ ACL username

        # Configure SSL for production
        if mode == ModeEnum.production or (
            mode == ModeEnum.testing and os.getenv("REDIS_SSL", "false").lower() == "true"
        ):
            ssl_context = cls._get_ssl_context(mode)
            if ssl_context:
                params["ssl"] = True
                params["ssl_context"] = ssl_context

                # Override host verification if needed (for self-signed certs in testing)
                if mode == ModeEnum.testing:
                    check_hostname = os.getenv("REDIS_SSL_CHECK_HOSTNAME", "false").lower() == "true"
                    ssl_context.check_hostname = check_hostname
                    logger.info(f"Testing mode: SSL hostname verification = {check_hostname}")

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

        # Add pooling-specific parameters
        pool_params = {
            **params,
            "max_connections": max_connections,
            "connection_class": aioredis.Connection,
        }

        logger.info(
            f"Creating Redis connection pool for {params['host']}:{params['port']}, "
            f"db={db}, max_connections={max_connections}, ssl={params.get('ssl', False)}"
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
