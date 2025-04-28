import os
from typing import AsyncGenerator, Dict

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.core.config import settings
from app.db.init_db import init_db

# Import our app code
from app.main import fastapi_app as main_app
from app.tests.utils import random_email, random_lower_string

# Set the mode to testing to ensure we use test settings
os.environ["MODE"] = "testing"

# Create a test database URL - use SQLite in memory for tests
TEST_SQLALCHEMY_DATABASE_URI = "sqlite+aiosqlite:///:memory:"


# Define a session-scoped event loop fixture
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test session."""
    import asyncio

    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Fixture to setup the test database
@pytest_asyncio.fixture(scope="session")
async def db_engine():
    # Create an engine connected to a test database
    engine = create_async_engine(TEST_SQLALCHEMY_DATABASE_URI, echo=False)

    # Import all models to ensure they are registered with SQLAlchemy

    # Create all tables
    async with engine.begin() as conn:
        # Import SQLModel from your models
        from app.models.base_uuid_model import SQLModel

        await conn.run_sync(SQLModel.metadata.create_all)

    # Initialize the database with test data
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await init_db(session)

    # Return the engine
    yield engine

    # Clean up - drop all tables
    async with engine.begin() as conn:
        from app.models.base_uuid_model import SQLModel

        await conn.run_sync(SQLModel.metadata.drop_all)


# Fixture to provide a database session for tests
@pytest_asyncio.fixture(scope="function")
async def db(db_engine) -> AsyncGenerator[AsyncSession, None]:
    # Create a new sessionmaker bound to the engine
    async_session = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    # Create a new session for each test
    async with async_session() as session:
        yield session
        # Roll back any changes made during the test
        await session.rollback()


# Fixture to override the dependency in FastAPI app
@pytest_asyncio.fixture(scope="function")
async def app(db) -> FastAPI:
    # Override the get_db dependency to use our test database
    async def get_test_db():
        try:
            yield db
        finally:
            pass

    # Override the dependency
    main_app.dependency_overrides[get_db] = get_test_db

    return main_app


# Fixture to provide a test client
@pytest_asyncio.fixture(scope="function")
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    # Use httpx's AsyncClient for testing the API
    from httpx import ASGITransport

    # Create an ASGITransport with the FastAPI app
    transport = ASGITransport(app=app)

    # Create AsyncClient with the transport
    async with AsyncClient(transport=transport, base_url="http://test") as test_client:
        yield test_client


# Fixture for a superuser token
@pytest_asyncio.fixture(scope="function")
async def superuser_token_headers(client) -> Dict[str, str]:
    login_data = {
        "username": settings.FIRST_SUPERUSER_EMAIL,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    response = await client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data=login_data,  # Changed from json=login_data to data=login_data
    )
    tokens = response.json()
    access_token = tokens["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


# Fixture for a regular user token
@pytest_asyncio.fixture(scope="function")
async def normal_user_token_headers(client, db) -> Dict[str, str]:
    # Import user creation functions
    from app.crud.user_crud import user_crud
    from app.schemas.user_schema import IUserCreate

    # Create a regular user
    email = random_email()
    password = random_lower_string()
    user_in = IUserCreate(
        email=email,
        password=password,
        is_active=True,
    )
    await user_crud.create(obj_in=user_in, db_session=db)

    # Login as the user
    login_data = {
        "username": email,
        "password": password,
    }
    response = await client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data=login_data,  # Changed from json=login_data to data=login_data
    )
    tokens = response.json()
    access_token = tokens["access_token"]
    return {"Authorization": f"Bearer {access_token}"}
