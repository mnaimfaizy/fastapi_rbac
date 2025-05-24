"""
Enhanced token management utilities for secure session handling.
"""

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from jose import jwt
from jose.exceptions import (  # MODIFIED: Import specific exceptions
    ExpiredSignatureError,
    JWTClaimsError,
    JWTError,
)
from redis.asyncio import Redis

from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType

logger = logging.getLogger(__name__)


class TokenManager:
    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    async def create_token(
        self,
        user: User,
        token_type: TokenType,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> str:
        """Create a new token with enhanced security features."""
        # Generate session ID for token tracking
        session_id = hashlib.sha256(os.urandom(32)).hexdigest()

        # Get appropriate expiry based on token type
        expiry_minutes = {
            TokenType.ACCESS: settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            TokenType.REFRESH: settings.REFRESH_TOKEN_EXPIRE_MINUTES,
            TokenType.RESET: settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
            TokenType.VERIFICATION: settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES,
        }[token_type]

        # Prepare claims with security-enhancing metadata
        claims = {
            "sub": str(user.id),
            "email": user.email,
            "type": token_type,
            "jti": session_id,  # Unique token ID
            "iat": datetime.now(timezone.utc),
            "nbf": datetime.now(timezone.utc),  # Not valid before
            "exp": datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes),
            "iss": settings.TOKEN_ISSUER,
            "aud": settings.TOKEN_AUDIENCE,
            "version": user.password_version,  # Invalidate on password change
        }

        # Add contextual security metadata if available
        if ip_address:
            claims["ip"] = self._hash_ip(ip_address)
        if user_agent:
            claims["ua"] = hashlib.sha256(user_agent.encode()).hexdigest()

        # Select appropriate secret based on token type
        secret = {
            TokenType.ACCESS: settings.SECRET_KEY,
            TokenType.REFRESH: settings.JWT_REFRESH_SECRET_KEY,
            TokenType.RESET: settings.JWT_RESET_SECRET_KEY,
            TokenType.VERIFICATION: settings.JWT_VERIFICATION_SECRET_KEY,
        }[token_type]

        # Generate token with high entropy
        token = jwt.encode(claims, secret, algorithm=settings.ALGORITHM)

        # Store token metadata in Redis
        await self._store_token_metadata(user.id, token_type, session_id, claims)

        return token

    async def validate_token(
        self,
        token: str,
        token_type: TokenType,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict:
        """
        Validate a token with comprehensive security checks.

        Performs:
        - Signature validation
        - Expiry check
        - Type verification
        - Claims validation
        - Redis blacklist check
        - IP validation (if enabled)
        - Concurrent session limit check
        - User agent validation (if enabled)
        """
        try:
            # Select appropriate secret
            secret = {
                TokenType.ACCESS: settings.SECRET_KEY,
                TokenType.REFRESH: settings.JWT_REFRESH_SECRET_KEY,
                TokenType.RESET: settings.JWT_RESET_SECRET_KEY,
                TokenType.VERIFICATION: settings.JWT_VERIFICATION_SECRET_KEY,
            }[token_type]

            # Decode and validate token
            payload = jwt.decode(
                token,
                secret,
                algorithms=[settings.ALGORITHM],
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                    "leeway": 300,  # 5 minutes leeway for clock skew
                },
            )

            # Verify token type
            if payload.get("type") != token_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Invalid token type. Expected {token_type}.",
                )

            # Check Redis blacklist
            if await self._is_token_blacklisted(payload["jti"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been invalidated.",
                )

            # Validate IP if enabled
            if settings.VALIDATE_TOKEN_IP and ip_address:
                if payload.get("ip") != self._hash_ip(ip_address):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token IP mismatch.",
                    )

            # Validate user agent if present
            if user_agent and payload.get("ua"):
                if payload["ua"] != hashlib.sha256(user_agent.encode()).hexdigest():
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User agent mismatch.",
                    )

            # Check concurrent session limit
            if settings.CONCURRENT_SESSION_LIMIT:
                active_sessions = await self._count_active_sessions(UUID(payload["sub"]), token_type)
                if active_sessions > settings.CONCURRENT_SESSION_LIMIT:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Maximum number of concurrent sessions exceeded.",
                    )

            return payload

        except ExpiredSignatureError:  # MODIFIED: Use imported ExpiredSignatureError
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired.",
            )
        except JWTClaimsError as e:  # MODIFIED: Use imported JWTClaimsError
            logger.warning(f"Token claims validation failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims.",
            )
        except JWTError as e:  # MODIFIED: Use imported JWTError
            logger.error(f"Token validation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate token.",
            )
        except Exception as e:
            logger.error(f"Unexpected error validating token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token validation failed.",
            )

    async def invalidate_token(self, token: str, token_type: TokenType) -> None:
        """Invalidate a specific token."""
        try:
            # Decode token without verification to get jti
            payload = jwt.get_unverified_claims(token)  # MODIFIED: Use get_unverified_claims
            jti = payload.get("jti")
            if jti:
                # Add to blacklist with expiry matching token
                await self.redis.setex(
                    f"token_blacklist:{jti}",
                    timedelta(seconds=settings.TOKEN_BLACKLIST_EXPIRY),
                    "1",
                )
        except Exception as e:
            logger.error(f"Error invalidating token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not invalidate token.",
            )

    async def invalidate_all_user_tokens(self, user_id: UUID) -> None:
        """Invalidate all tokens for a user (e.g., on password change)."""
        try:
            # Get all active sessions for user
            pattern = f"token_metadata:{user_id}:*"
            keys = await self.redis.keys(pattern)

            # Add all tokens to blacklist
            for key in keys:
                metadata = await self.redis.get(key)
                if metadata:
                    data = json.loads(metadata)
                    jti = data.get("jti")
                    if jti:
                        await self.redis.setex(
                            f"token_blacklist:{jti}",
                            timedelta(seconds=settings.TOKEN_BLACKLIST_EXPIRY),
                            "1",
                        )
                # Delete metadata
                await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Error invalidating user tokens: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not invalidate user tokens.",
            )

    async def _store_token_metadata(
        self, user_id: UUID, token_type: TokenType, session_id: str, claims: dict
    ) -> None:
        """Store token metadata in Redis for tracking."""
        key = f"token_metadata:{user_id}:{token_type}:{session_id}"
        metadata = {
            "jti": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": claims["exp"].isoformat(),
            "ip": claims.get("ip"),
            "ua": claims.get("ua"),
        }
        # Store with TTL matching token expiry
        await self.redis.setex(
            key,
            timedelta(minutes=claims["exp"] - claims["iat"]),
            json.dumps(metadata),
        )

    async def _is_token_blacklisted(self, jti: str) -> bool:
        """Check if a token is blacklisted."""
        return bool(await self.redis.exists(f"token_blacklist:{jti}"))

    async def _count_active_sessions(self, user_id: UUID, token_type: TokenType) -> int:
        """Count active sessions for a user."""
        pattern = f"token_metadata:{user_id}:{token_type}:*"
        keys = await self.redis.keys(pattern)
        return len(keys)

    @staticmethod
    def _hash_ip(ip: str) -> str:
        """Create a secure hash of an IP address."""
        return hmac.new(settings.SECRET_KEY.encode(), ip.encode(), hashlib.sha256).hexdigest()
