import pytest
from redis.asyncio import Redis
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_async_session, get_redis_client
from app.models.user_model import User  # Import a model to test session


@pytest.mark.asyncio
async def test_get_async_session_yields_session():
    """
    Test that get_async_session yields an AsyncSession instance.
    """
    session_generator = get_async_session()
    session = await anext(session_generator)
    assert isinstance(session, AsyncSession)
    # Ensure the session is closed properly to avoid warnings/errors
    try:
        await anext(session_generator)
    except StopAsyncIteration:
        pass  # Expected behavior


@pytest.mark.asyncio
async def test_async_session_usable():
    """
    Test that the yielded session can execute queries using session.exec().
    """
    async for session in get_async_session():
        # Execute a simple query using session.exec()
        stmt = select(User).limit(1)
        # Use session.exec() which is preferred for SQLModel
        result = await session.exec(stmt)
        # Use unique() to handle potential joined eager loads, then one_or_none()
        result.unique().one_or_none()
        # We don't assert the user exists, just that the query runs without error
        assert True  # If query executes without error, the session is usable


@pytest.mark.asyncio
async def test_get_redis_client_yields_client():
    """
    Test that get_redis_client yields a Redis client instance.
    """
    client_generator = get_redis_client()
    client = await anext(client_generator)
    assert isinstance(client, Redis)
    # Ensure the client is closed properly
    try:
        await anext(client_generator)
    except StopAsyncIteration:
        pass


@pytest.mark.asyncio
async def test_redis_client_usable():
    """
    Test that the yielded Redis client can connect and ping the server.
    """
    async for client in get_redis_client():
        # Ping the Redis server to check connectivity
        pong = await client.ping()
        assert pong is True


# Helper to get the next item from an async generator
async def anext(iterator):
    return await iterator.__anext__()
