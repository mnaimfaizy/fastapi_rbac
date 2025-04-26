# https://stackoverflow.com/questions/75252097/fastapi-testing-runtimeerror-task-attached-to-a-different-loop/75444607#75444607
from typing import AsyncGenerator

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import ModeEnum, settings

DB_POOL_SIZE = 83
WEB_CONCURRENCY = 9
POOL_SIZE = max(DB_POOL_SIZE // WEB_CONCURRENCY, 5)

connect_args = {"check_same_thread": False}

engine = create_async_engine(
    str(settings.ASYNC_DATABASE_URI),
    echo=False,
    poolclass=(
        NullPool if settings.MODE == ModeEnum.testing else AsyncAdaptedQueuePool
    ),  # Asincio pytest works with NullPool
    # pool_size=POOL_SIZE,
    # max_overflow=64,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

engine_celery = create_async_engine(
    str(settings.ASYNC_CELERY_BEAT_DATABASE_URI),
    echo=False,
    poolclass=(
        NullPool if settings.MODE == ModeEnum.testing else AsyncAdaptedQueuePool
    ),  # Asincio pytest works with NullPool
    # pool_size=POOL_SIZE,
    # max_overflow=64,
)

SessionLocalCelery = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_celery,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Add the missing async session provider function
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create and get async database session.
    This function yields an AsyncSession for use in async context managers or dependency injection.
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Add the Redis client function that's also likely needed
def get_redis_client():
    """
    Get Redis client instance.
    Returns a Redis client configured to connect to the Redis server specified in settings.
    """
    redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
    return aioredis.from_url(redis_url, decode_responses=True)
