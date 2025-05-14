"""
Dependency mocking utilities for testing.

This module provides tools to mock FastAPI dependencies.
"""

from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Type, TypeVar

import pytest_asyncio
from fastapi import FastAPI

from app.models.user_model import User
from app.utils.uuid6 import uuid7

T = TypeVar("T")


class DependencyOverrider:
    """
    Context manager for temporarily overriding FastAPI dependencies during tests.

    Usage:
    ```
    with DependencyOverrider(app, {deps.get_current_user: lambda: mock_user}):
        # Run test code here
    ```
    """

    def __init__(self, app: FastAPI, overrides: Dict[Callable[..., Any], Callable[..., Any]]):
        """
        Initialize with app and overrides dictionary.

        Args:
            app: FastAPI application
            overrides: Dict mapping from dependency to its override
        """
        self.app = app
        self.overrides = overrides
        self.original_overrides: Dict[Callable[..., Any], Callable[..., Any]] = {}

    def __enter__(self) -> "DependencyOverrider":
        """Store original overrides and apply new ones."""
        # Save original overrides
        for dep in self.overrides:
            if dep in self.app.dependency_overrides:
                self.original_overrides[dep] = self.app.dependency_overrides[dep]

        # Apply new overrides
        for dep, override in self.overrides.items():
            self.app.dependency_overrides[dep] = override

        return self

    def __exit__(
        self, exc_type: Optional[Type[BaseException]], exc_val: Optional[BaseException], exc_tb: Optional[Any]
    ) -> None:
        """Restore original overrides."""
        # Remove our overrides
        for dep in self.overrides.keys():
            if dep in self.app.dependency_overrides:
                del self.app.dependency_overrides[dep]

        # Restore original overrides
        for dep, override in self.original_overrides.items():
            self.app.dependency_overrides[dep] = override


def create_mock_user(
    *,
    id: Optional[str] = None,
    email: str = "test@example.com",
    is_active: bool = True,
    is_superuser: bool = False,
    first_name: str = "Test",
    last_name: str = "User",
    roles: Optional[List[Any]] = None,
) -> User:
    """Create a mock User object with specified attributes."""
    user = User(
        id=id or uuid7(),
        email=email,
        password="hashed_password_not_relevant",
        is_active=is_active,
        is_superuser=is_superuser,
        first_name=first_name,
        last_name=last_name,
    )

    # Add roles if provided
    if roles:
        user.roles = roles

    return user


def mock_current_user_factory(
    override_user: Optional[User] = None, **user_kwargs: Any
) -> Callable[[], Callable[[], User]]:
    """
    Create a factory function that returns a dependency override for get_current_user.

    This allows easily mocking the current user in tests.

    Args:
        override_user: Specific user to return, or None to create one with kwargs
        **user_kwargs: Attributes to set on the mock user if override_user is None

    Returns:
        Function that can be used as a dependency override
    """

    async def async_mock_current_user() -> User:
        """Return the mock user."""
        if override_user:
            return override_user
        return create_mock_user(**user_kwargs)

    def mock_current_user() -> User:
        """Synchronous wrapper for the async mock user function."""
        import asyncio

        return asyncio.run(async_mock_current_user())

    return lambda: mock_current_user


def mock_dependency(*args: Any, **kwargs: Any) -> Callable[[], AsyncGenerator[T, None]]:
    """
    Create a dependency that returns mock data.

    Usage:
    ```
    app.dependency_overrides[deps.get_db] = mock_dependency(mock_db_session)
    ```
    """
    mock_return_value = args[0] if args else None

    async def _mock_dependency() -> AsyncGenerator[Any, None]:
        yield mock_return_value

    return _mock_dependency


@pytest_asyncio.fixture(scope="function")
async def dependency_overrider(
    app: FastAPI,
) -> Callable[[Dict[Callable[..., Any], Callable[..., Any]]], DependencyOverrider]:
    """
    Fixture that provides an instance of DependencyOverrider.

    Usage:
    ```
    async def test_something(dependency_overrider, app):
        with dependency_overrider({deps.get_current_user: mock_current_user_factory()}):
            # Test code here
    ```
    """
    return lambda overrides: DependencyOverrider(app, overrides)
