"""
Authentication-related factories for testing.

This module provides factories for generating authentication-related
test data like tokens, headers, etc.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import jwt

from app.core.config import settings
from app.utils.uuid6 import uuid7


class TokenFactory:
    """Factory for generating JWT tokens for testing."""

    @staticmethod
    def create_access_token(
        user_id: Optional[str] = None,
        expires_delta: Optional[timedelta] = None,
        scopes: Optional[List[str]] = None,
        is_superuser: bool = False,
        **extra_claims: Any,
    ) -> str:
        """
        Generate a test access token.

        Args:
            user_id: User ID to include in the token
            expires_delta: Optional expiration time override
            scopes: Optional list of scopes to include
            is_superuser: Whether to mark the user as a superuser
            extra_claims: Additional claims to include in the token

        Returns:
            JWT token string
        """
        # Default values
        user_id = user_id or str(uuid7())
        scopes = scopes or ["user:read"]
        expires = expires_delta or timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

        to_encode = {
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + expires,
            "iat": datetime.now(timezone.utc),
            "scopes": scopes,
            "is_superuser": is_superuser,
            **extra_claims,
        }

        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def create_refresh_token(
        user_id: Optional[str] = None,
        expires_delta: Optional[timedelta] = None,
        **extra_claims: Any,
    ) -> str:
        """
        Generate a test refresh token.

        Args:
            user_id: User ID to include in the token
            expires_delta: Optional expiration time override
            extra_claims: Additional claims to include in the token

        Returns:
            JWT refresh token string
        """
        user_id = user_id or str(uuid7())
        expires = expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_MINUTES)

        to_encode = {
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + expires,
            "iat": datetime.now(timezone.utc),
            "token_type": "refresh",
            **extra_claims,
        }

        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    @staticmethod
    def create_auth_headers(
        access_token: Optional[str] = None,
        user_id: Optional[str] = None,
        is_superuser: bool = False,
    ) -> Dict[str, str]:
        """
        Generate authentication headers for testing.

        Args:
            access_token: Optional pre-generated token
            user_id: User ID to include if generating a token
            is_superuser: Whether the user is a superuser

        Returns:
            Dict containing Authorization header
        """
        if not access_token:
            access_token = TokenFactory.create_access_token(
                user_id=user_id, is_superuser=is_superuser
            )

        return {"Authorization": f"Bearer {access_token}"}

    @staticmethod
    def create_expired_token(
        user_id: Optional[str] = None,
        expired_by: timedelta = timedelta(hours=1),
    ) -> str:
        """
        Generate an expired token for testing expiration handling.

        Args:
            user_id: User ID to include in the token
            expired_by: How long ago the token expired

        Returns:
            Expired JWT token string
        """
        user_id = user_id or str(uuid7())
        expires = timedelta(minutes=-expired_by.total_seconds() / 60)

        return TokenFactory.create_access_token(user_id=user_id, expires_delta=expires)
