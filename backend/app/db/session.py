# https://stackoverflow.com/questions/75252097/fastapi-testing-runtimeerror-task-attached-to-a-different-loop/75444607#75444607
from typing import AsyncGenerator

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
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

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
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

SessionLocalCelery = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_celery,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
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


async def get_redis_client() -> AsyncGenerator[aioredis.Redis, None]:
    """
    Get Redis client instance as an async generator.
    Yields a Redis client configured to connect
    to the Redis server specified in settings.
    This function implements the async iterator pattern
    to be compatible with 'async for' usage.
    """
    redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    try:
        yield redis_client
    finally:
        await redis_client.close()
