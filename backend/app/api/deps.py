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

# Ensure Permission model and relationship attributes are correctly imported/handled
# from app.models.permission_model import Permission # If direct import is needed
# from app.schemas.role_schema import IRoleEnum # If still used elsewhere or for default roles


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


# Modify the function signature and logic
def get_current_user(
    required_permissions: list[str] | None = None,
) -> Callable[..., Coroutine[Any, Any, User]]:
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
                detail="There is no required field in your token. Please contact the administrator.",
            )

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User identifier not found in token.",
            )
        try:
            user_id = UUID(user_id_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid user identifier in token.",
            )

        valid_access_tokens = await get_valid_tokens(redis_client, user_id_str, TokenType.ACCESS)
        if valid_access_tokens and access_token not in valid_access_tokens:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not validate credentials, token invalid or revoked.",
            )

        user_from_db = await crud.user.get(id=user_id, db_session=db_session)

        if not user_from_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if not user_from_db.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user.")

        if hasattr(user_from_db, "is_superuser") and user_from_db.is_superuser:
            return user_from_db

        if required_permissions:
            user_perms_set: set[str] = set()
            if hasattr(user_from_db, "roles") and user_from_db.roles:
                for role in user_from_db.roles:
                    # Ensure role.permissions is loaded (might require eager loading in CRUD)
                    if hasattr(role, "permissions") and role.permissions:
                        for perm in role.permissions:
                            if hasattr(perm, "name"):
                                user_perms_set.add(perm.name)

            missing_perms = [p_name for p_name in required_permissions if p_name not in user_perms_set]

            if missing_perms:
                detail_msg = f"Insufficient permissions. Missing: {', '.join(missing_perms)}"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=detail_msg,
                )

        return user_from_db

    return current_user
