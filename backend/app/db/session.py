# https://stackoverflow.com/questions/75252097/fastapi-testing-runtimeerror-task-attached-to-a-different-loop/75444607#75444607
from typing import Any, AsyncGenerator

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import ModeEnum, settings

DB_POOL_SIZE = settings.DB_POOL_SIZE
WEB_CONCURRENCY = settings.WEB_CONCURRENCY
POOL_SIZE = max(DB_POOL_SIZE // WEB_CONCURRENCY, 5)

# Create engine with different configurations based on mode
if settings.MODE == ModeEnum.testing:
    # For testing, use NullPool without pool sizing parameters
    engine = create_async_engine(
        str(settings.ASYNC_DATABASE_URI),
        echo=False,
        poolclass=NullPool,
    )
else:
    # For development/production, use connection pooling
    engine = create_async_engine(
        str(settings.ASYNC_DATABASE_URI),
        echo=False,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=POOL_SIZE,
        max_overflow=64,
    )

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Configure Celery database connection if needed
# Use the main database URI as fallback if Celery-specific URI is not defined
celery_db_uri = getattr(settings, "ASYNC_CELERY_DATABASE_URI", None) or settings.ASYNC_DATABASE_URI

# Use separate engine to avoid conflicts with main connection pool
if settings.MODE == ModeEnum.testing:
    engine_celery = create_async_engine(
        str(celery_db_uri),
        echo=False,
        poolclass=NullPool,
    )
else:
    engine_celery = create_async_engine(
        str(celery_db_uri),
        echo=False,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=POOL_SIZE,
        max_overflow=64,
    )

SessionLocalCelery = async_sessionmaker(
    bind=engine_celery,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, Any]:
    """
    Create and get async database session.
    This function yields an AsyncSession for
    use in async context managers or dependency injection.
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_redis_client() -> AsyncGenerator[aioredis.Redis, Any]:
    """
    Get Redis client instance as an async generator.
    Yields a Redis client configured to connect
    to the Redis server specified in settings.
    This function implements the async iterator pattern
    to be compatible with 'async for' usage.

    Uses the new RedisConnectionFactory for improved SSL handling,
    connection pooling, and error resilience.
    """
    from app.utils.redis_connection import RedisConnectionFactory

    # Get client from the connection pool
    redis_client = await RedisConnectionFactory.get_client()

    try:
        yield redis_client
    finally:
        # Connection is returned to pool, not closed
        # The pool manages connection lifecycle
        pass
