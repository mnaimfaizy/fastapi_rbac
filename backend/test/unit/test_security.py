from datetime import timedelta
from typing import Literal

import jwt
import pytest
from fastapi import HTTPException, status
from jwt.exceptions import ExpiredSignatureError

from app.core.config import settings
from app.core.security import (
    PasswordValidator,
    create_access_token,
    create_refresh_token,
    decode_token,
    map_jwt_http_error_to_event,
)


def test_password_hashing() -> None:
    """Test password hashing and verification"""
    # Test that hashing works
    password = "test-password"
    hashed_password = PasswordValidator.get_password_hash(password)

    # Hashed password should be different from the original
    assert password != hashed_password

    # Verification should work
    assert PasswordValidator.verify_password(password, hashed_password)

    # Verification should fail for wrong password
    assert not PasswordValidator.verify_password("wrong-password", hashed_password)


def test_access_token_generation() -> None:
    """Test JWT access token generation"""
    # Generate an access token with some claims
    user_id = "test-user-id"

    # Create a token with 15 minutes expiration
    expires_delta = timedelta(minutes=15)
    token = create_access_token(user_id, expires_delta=expires_delta)

    # Token should be a non-empty string
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode the token and verify its content
    decoded = jwt.decode(
        token,
        settings.SECRET_KEY,  # Changed from settings.ENCRYPT_KEY
        algorithms=[settings.ALGORITHM],
        audience=settings.TOKEN_AUDIENCE,
        issuer=settings.TOKEN_ISSUER,
    )

    # Check if the token contains the correct information
    assert decoded["sub"] == user_id
    assert "exp" in decoded
    assert "iat" in decoded
    assert "iss" in decoded
    assert decoded["iss"] == settings.TOKEN_ISSUER
    assert "aud" in decoded
    assert decoded["aud"] == settings.TOKEN_AUDIENCE


def test_refresh_token_generation() -> None:
    """Test JWT refresh token generation"""
    # Generate a refresh token
    user_id = "test-user-id"

    # Create a token with 7 days expiration
    expires_delta = timedelta(days=7)
    token = create_refresh_token(user_id, expires_delta=expires_delta)

    # Token should be a non-empty string
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode the token and verify its content
    decoded = jwt.decode(
        token,
        settings.JWT_REFRESH_SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        audience=settings.TOKEN_AUDIENCE,
        issuer=settings.TOKEN_ISSUER,
    )

    # Check if the token contains the correct information
    assert decoded["sub"] == user_id
    assert "exp" in decoded
    assert "iat" in decoded
    assert "iss" in decoded
    assert decoded["iss"] == settings.TOKEN_ISSUER
    assert "type" in decoded
    assert decoded["type"] == "refresh"
    assert "aud" in decoded
    assert decoded["aud"] == settings.TOKEN_AUDIENCE


def test_token_expiration() -> None:
    """Test that tokens expire correctly"""
    # Generate a token that's already expired
    user_id = "test-user-id"
    expires_delta = timedelta(minutes=-1)  # Token expired 1 minute ago

    token = create_access_token(user_id, expires_delta=expires_delta)

    # Decoding should fail with an expired token
    with pytest.raises(ExpiredSignatureError):  # Changed from jwt.ExpiredSignatureError
        jwt.decode(
            token,
            settings.SECRET_KEY,  # Changed from settings.ENCRYPT_KEY
            algorithms=[settings.ALGORITHM],
            audience=settings.TOKEN_AUDIENCE,
            issuer=settings.TOKEN_ISSUER,
        )


def test_decode_token() -> None:
    """Test token decoding function"""
    # Generate a valid token
    user_id = "test-user-id"
    token = create_access_token(user_id)

    # Decode the token
    decoded = decode_token(token)

    # Check if the token is decoded correctly
    assert decoded["sub"] == user_id


@pytest.mark.parametrize(
    ("detail", "flow", "expected"),
    [
        ("Token has expired", "refresh", "refresh_token_expired"),
        ("Missing required claims: {'sub'}", "refresh", "refresh_token_missing_claim"),
        ("Invalid token format", "refresh", "refresh_token_decode_error"),
        ("Invalid token", "refresh", "refresh_token_decode_error"),
        ("Invalid token audience", "refresh", "refresh_token_decode_error"),
        ("Token has expired", "verify_email", "verify_email_token_invalid_expired"),
        (
            "Missing required claims: {'jti'}",
            "verify_email",
            "verify_email_token_invalid_missing_claim",
        ),
        ("Invalid token format", "verify_email", "verify_email_token_invalid_decode"),
        ("Invalid token", "verify_email", "verify_email_token_invalid_decode"),
        ("Token not yet valid", "verify_email", "verify_email_token_invalid_decode"),
    ],
)
def test_map_jwt_http_error_to_event(
    detail: str, flow: Literal["refresh", "verify_email"], expected: str
) -> None:
    """Map decode_token HTTPException details to typed security audit event names."""
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)
    assert map_jwt_http_error_to_event(exc, flow=flow) == expected
