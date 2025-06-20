"""
Enhanced test fixtures using async factories.

This module provides pytest fixtures that use the async factories
for creating test data.
"""

from test.factories.async_factories import (
    AsyncPermissionFactory,
    AsyncPermissionGroupFactory,
    AsyncRoleFactory,
    AsyncRoleGroupFactory,
    AsyncTestDataBuilder,
    AsyncUserFactory,
)
from typing import Any, Dict

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user_model import User


@pytest.fixture
async def user_factory(db: AsyncSession) -> AsyncUserFactory:
    """Provide an async user factory."""
    return AsyncUserFactory(db)


@pytest.fixture
async def role_factory(db: AsyncSession) -> AsyncRoleFactory:
    """Provide an async role factory."""
    return AsyncRoleFactory(db)


@pytest.fixture
async def permission_factory(db: AsyncSession) -> AsyncPermissionFactory:
    """Provide an async permission factory."""
    return AsyncPermissionFactory(db)


@pytest.fixture
async def permission_group_factory(db: AsyncSession) -> AsyncPermissionGroupFactory:
    """Provide an async permission group factory."""
    return AsyncPermissionGroupFactory(db)


@pytest.fixture
async def role_group_factory(db: AsyncSession) -> AsyncRoleGroupFactory:
    """Provide an async role group factory."""
    return AsyncRoleGroupFactory(db)


@pytest.fixture
async def test_data_builder(db: AsyncSession) -> AsyncTestDataBuilder:
    """Provide a test data builder for complex scenarios."""
    return AsyncTestDataBuilder(db)


@pytest.fixture
async def basic_rbac_setup(test_data_builder: AsyncTestDataBuilder) -> Dict[str, Any]:
    """Create a basic RBAC setup for testing."""
    return await test_data_builder.create_basic_rbac_setup()


@pytest.fixture
async def admin_user(user_factory: AsyncUserFactory) -> User:
    """Create an admin user for testing."""
    return await user_factory.create_admin()


@pytest.fixture
async def regular_user(user_factory: AsyncUserFactory) -> User:
    """Create a regular user for testing."""
    return await user_factory.create()


@pytest.fixture
async def locked_user(user_factory: AsyncUserFactory) -> User:
    """Create a locked user for testing."""
    return await user_factory.create_locked()


@pytest.fixture
async def unverified_user(user_factory: AsyncUserFactory) -> User:
    """Create an unverified user for testing."""
    return await user_factory.create_unverified()
