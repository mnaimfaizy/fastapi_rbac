"""
This module contains the dependency injection utilities
used across the FastAPI application.
"""

from collections.abc import AsyncGenerator, Coroutine
from typing import Any, Callable
from uuid import UUID  # Import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import Settings, settings
from app.core.security import decode_token
from app.db.session import SessionLocal, get_redis_client
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.token import get_valid_tokens

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/access-token")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Get database session for dependency injection.
    Uses AsyncSession to ensure all database operations occur within proper async context.
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


def get_settings_dependency() -> Settings:
    return settings


# Alias for get_db to maintain consistent naming
get_async_db = get_db


def get_current_user(required_roles: list[str] | None = None) -> Callable[..., Coroutine[Any, Any, User]]:
    async def current_user(
        access_token: str = Depends(reusable_oauth2),
        redis_client: Redis = Depends(get_redis_client),
        db_session: AsyncSession = Depends(get_db),
    ) -> User:
        try:
            payload = decode_token(access_token)
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your token has expired. Please log in again.",
            )
        except DecodeError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Error when decoding the token. Please check your request.",
            )
        except MissingRequiredClaimError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="There is no required field in your token. " "Please contact the administrator.",
            )

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User identifier not found in token.",
            )
        try:
            user_id = UUID(user_id_str)  # Convert string to UUID
        except ValueError:
            # Handle cases where the 'sub' claim is not a valid UUID string
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid user identifier in token.",
            )

        valid_access_tokens = await get_valid_tokens(redis_client, user_id_str, TokenType.ACCESS)
        if valid_access_tokens and access_token not in valid_access_tokens:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not validate credentials",
            )

        user_from_db = await crud.user.get(id=user_id, db_session=db_session)
        if not user_from_db:
            raise HTTPException(status_code=404, detail="User not found")

        if not user_from_db.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # if required_roles:
        #     is_valid_role = False
        #     # Ensure user.roles is loaded and is a list of Role objects
        #     user_roles_names = [role.name for role in user_from_db.roles if hasattr(role, 'name')]
        #     for role_name in required_roles:
        #         if role_name in user_roles_names:
        #             is_valid_role = True
        #             break
        #
        #     if not is_valid_role:
        #         raise HTTPException(
        #             status_code=status.HTTP_403_FORBIDDEN,
        #             detail=f"Role(s) {required_roles} are required for this action",
        #         )

        return user_from_db

    return current_user
