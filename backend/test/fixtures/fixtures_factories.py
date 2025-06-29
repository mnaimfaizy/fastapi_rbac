"""
Factory fixtures for tests.

This module integrates factory_boy factories with pytest fixtures.
"""

from test.factories.rbac_factory import (
    PermissionFactory,
    PermissionGroupFactory,
    RoleFactory,
    RoleGroupFactory,
)
from test.factories.user_factory import UserFactory
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Protocol

import pytest
import pytest_asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

# Type aliases for better readability
FactoryCallable = Callable[..., Any]


class HeadersCallable(Protocol):
    def __call__(
        self, user_id: Optional[str] = None, is_superuser: bool = False, **token_kwargs: Any
    ) -> Dict[str, str]: ...


@pytest_asyncio.fixture(scope="function")
async def db_factories(db: AsyncSession) -> AsyncGenerator[None, None]:
    """Setup factories to use the test database session."""
    # Set the SQLAlchemy session for all factories
    factories = [
        UserFactory,
        RoleFactory,
        PermissionFactory,
        PermissionGroupFactory,
        RoleGroupFactory,
    ]

    for factory in factories:
        factory._meta.sqlalchemy_session_persistence = "commit"  # type: ignore
        factory._meta.sqlalchemy_session = db  # type: ignore

    yield

    # Reset DB session to None after the test
    for factory in factories:
        factory._meta.sqlalchemy_session = None  # type: ignore


@pytest_asyncio.fixture(scope="function")
async def make_user(db_factories: None) -> FactoryCallable:
    """Factory fixture to create User instances."""

    async def _make_user(**kwargs: Any) -> Any:
        """Create and return a User instance."""
        return UserFactory(**kwargs)

    return _make_user


@pytest_asyncio.fixture(scope="function")
async def make_admin_user(db_factories: None) -> FactoryCallable:
    """Factory fixture to create admin User instances."""

    async def _make_admin_user(**kwargs: Any) -> Any:
        """Create and return an admin User instance."""
        return UserFactory.admin(**kwargs)

    return _make_admin_user


@pytest_asyncio.fixture(scope="function")
async def make_permission(db_factories: None) -> FactoryCallable:
    """Factory fixture to create Permission instances."""

    async def _make_permission(**kwargs: Any) -> Any:
        """Create and return a Permission instance."""
        return PermissionFactory(**kwargs)

    return _make_permission


@pytest_asyncio.fixture(scope="function")
async def make_permission_group(db_factories: None) -> FactoryCallable:
    """Factory fixture to create PermissionGroup instances."""

    async def _make_permission_group(**kwargs: Any) -> Any:
        """Create and return a PermissionGroup instance."""
        return PermissionGroupFactory(**kwargs)

    return _make_permission_group


@pytest_asyncio.fixture(scope="function")
async def make_role(db_factories: None) -> FactoryCallable:
    """Factory fixture to create Role instances."""

    async def _make_role(**kwargs: Any) -> Any:
        """Create and return a Role instance."""
        return RoleFactory(**kwargs)

    return _make_role


@pytest_asyncio.fixture(scope="function")
async def make_role_with_permissions(db_factories: None) -> FactoryCallable:
    """Factory fixture to create Role instances with permissions."""

    async def _make_role_with_permissions(
        permissions: Optional[List[Any]] = None, count: int = 2, **kwargs: Any
    ) -> Any:
        """Create and return a Role instance with permissions."""
        return RoleFactory.with_permissions(permissions=permissions, count=count, **kwargs)

    return _make_role_with_permissions


@pytest_asyncio.fixture(scope="function")
async def make_role_group(db_factories: None) -> FactoryCallable:
    """Factory fixture to create RoleGroup instances."""

    async def _make_role_group(**kwargs: Any) -> Any:
        """Create and return a RoleGroup instance."""
        return RoleGroupFactory(**kwargs)

    return _make_role_group


@pytest_asyncio.fixture
async def make_audit_log(db_factories: None, db: AsyncSession) -> FactoryCallable:
    """Factory fixture to create AuditLog instances."""
    from test.factories.audit_factory import AuditLogFactory

    AuditLogFactory._meta.sqlalchemy_session = db  # type: ignore

    async def _make_audit_log(**kwargs: Any) -> Any:
        """Create and return an AuditLog instance."""
        return AuditLogFactory(**kwargs)

    return _make_audit_log


@pytest.fixture
def token_factory() -> Any:
    """Factory fixture to create tokens for testing."""
    from test.factories.auth_factory import TokenFactory

    return TokenFactory


@pytest.fixture
def auth_headers() -> HeadersCallable:
    """Factory fixture to create authentication headers."""
    from test.factories.auth_factory import TokenFactory

    def _make_headers(
        user_id: Optional[str] = None, is_superuser: bool = False, **token_kwargs: Any
    ) -> Dict[str, str]:
        """Create and return authentication headers."""
        return TokenFactory.create_auth_headers(user_id=user_id, is_superuser=is_superuser, **token_kwargs)

    return _make_headers
