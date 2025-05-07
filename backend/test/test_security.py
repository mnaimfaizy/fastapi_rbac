from datetime import timedelta

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


def test_password_hashing() -> None:
    """Test password hashing and verification"""
    # Test that hashing works
    password = "test-password"
    hashed_password = get_password_hash(password)

    # Hashed password should be different from the original
    assert password != hashed_password

    # Verification should work
    assert verify_password(password, hashed_password)

    # Verification should fail for wrong password
    assert not verify_password("wrong-password", hashed_password)


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
        settings.ENCRYPT_KEY,
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
    with pytest.raises(jwt.ExpiredSignatureError):
        jwt.decode(
            token,
            settings.ENCRYPT_KEY,
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
