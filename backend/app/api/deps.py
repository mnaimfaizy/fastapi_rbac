"""
This module contains the dependency injection utilities used across the FastAPI application.
"""

from collections.abc import AsyncGenerator
from typing import Callable

import redis.asyncio as aioredis
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import DecodeError, ExpiredSignatureError, MissingRequiredClaimError
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import settings
from app.core.security import decode_token
from app.core.service_config import service_settings
from app.db.session import SessionLocal
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.token import get_valid_tokens

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


async def get_redis_client() -> Redis:
    """
    Get Redis client with environment-specific configuration.
    """
    redis_client = await aioredis.from_url(
        service_settings.redis_url, encoding="utf-8", decode_responses=True
    )
    try:
        yield redis_client
    finally:
        await redis_client.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


def get_current_user(required_roles: list[str] = None) -> Callable[[], User]:
    async def current_user(
        access_token: str = Depends(reusable_oauth2),
        redis_client: Redis = Depends(get_redis_client),
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

        user_id = payload["sub"]
        valid_access_tokens = await get_valid_tokens(
            redis_client, user_id, TokenType.ACCESS
        )
        if valid_access_tokens and access_token not in valid_access_tokens:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Could not validate credentials",
            )
        user: User = await crud.user.get(id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # if required_roles:
        #     is_valid_role = False
        #     for role in required_roles:
        #         if role == user.roles.name:
        #             is_valid_role = True
        #
        #     if not is_valid_role:
        #         raise HTTPException(
        #             status_code=403,
        #             detail=f"""Role "{required_roles}" is required for this action""",
        #         )

        return user

    return current_user
