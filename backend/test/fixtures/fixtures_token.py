"""
Fixture for token generation in tests.

This fixture creates proper tokens that work with the application's security system.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Optional

import jwt
import pytest_asyncio

from app.core.config import settings
from app.utils.uuid6 import uuid7


@pytest_asyncio.fixture
async def token_factory() -> Callable[..., str]:
    """Factory fixture to create tokens for testing."""

    def _create_token(
        user_id: str,
        role_names: Optional[list[str]] = None,
        expires_delta: Optional[timedelta] = None,
        refresh: bool = False,
        additional_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Create a token for testing.

        Args:
            user_id: The user ID to include in the token
            role_names: List of role names to include
            expires_delta: Optional override for token expiration
            refresh: Whether to create a refresh token
            additional_data: Additional data to include in the token

        Returns:
            A JWT token string
        """
        # Default role list
        if role_names is None:
            role_names = ["user"]

        # Calculate expiration
        if expires_delta is not None:
            expires = datetime.now(timezone.utc) + expires_delta
        elif refresh:
            expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        else:
            expires = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        # Create token data
        token_data = {
            "sub": str(user_id),
            "exp": expires,
            "iat": datetime.now(timezone.utc),
            "iss": settings.TOKEN_ISSUER,
            "aud": settings.TOKEN_AUDIENCE,
            "roles": role_names,
            "type": "refresh" if refresh else "access",
        }

        # Add additional data if provided
        if additional_data:
            token_data.update(additional_data)

        # Create and return the token
        return jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return _create_token


@pytest_asyncio.fixture
async def auth_headers() -> Callable[..., Dict[str, str]]:
    """Factory fixture to create authentication headers for testing."""

    def _create_headers(
        token: Optional[str] = None,
        user_id: Optional[str] = None,
        roles: Optional[list[str]] = None,
    ) -> Dict[str, str]:
        """
        Create authentication headers.

        Args:
            token: Optional pre-generated token
            user_id: User ID to include in token if generating one
            roles: Roles to include in token if generating one

        Returns:
            Dict containing Authorization header
        """
        if token is None:
            # Create token if not provided
            user_id = user_id or str(uuid7())
            roles = roles or ["user"]

            # Create token
            token_data = {
                "sub": user_id,
                "roles": roles,
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
                "iss": settings.TOKEN_ISSUER,
                "aud": settings.TOKEN_AUDIENCE,
                "type": "access",
            }

            token = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        # Return headers with token
        return {"Authorization": f"Bearer {token}"}

    return _create_headers
