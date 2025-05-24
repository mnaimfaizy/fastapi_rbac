import base64
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Union

import bcrypt
from cryptography.fernet import Fernet
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_fernet_key(key_str: str) -> Fernet:
    """
    Generate a valid Fernet key from an input string.
    Uses SHA-256 to derive a proper key if the input is not valid for Fernet.
    """
    try:
        # Try to use the key directly if it's already valid
        return Fernet(str.encode(key_str))
    except ValueError:
        # If not valid, derive a proper key using SHA-256
        hashed = hashlib.sha256(str.encode(key_str)).digest()
        encoded_key = base64.urlsafe_b64encode(hashed)
        return Fernet(encoded_key)


# Initialize Fernet with a valid key
fernet = get_fernet_key(settings.ENCRYPT_KEY)
JWT_ALGORITHM = settings.ALGORITHM


def add_token_claims(claims: dict[str, Any]) -> dict[str, Any]:
    """Add standard claims to JWT tokens for enhanced security."""
    now = datetime.now(timezone.utc)
    base_claims = {
        "iat": now,  # Issued at time
        "iss": settings.TOKEN_ISSUER,  # Token issuer
        "aud": settings.TOKEN_AUDIENCE,  # Intended audience
        "jti": base64.urlsafe_b64encode(os.urandom(32)).decode(),  # Unique token ID
        "nbf": now,  # Not valid before time
    }
    return {**base_claims, **claims}


def create_access_token(
    subject: Union[str, Any],
    email: Union[str, Any] = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = add_token_claims(
        {
            "exp": expire,
            "sub": str(subject),
            "type": "access",
        }
    )

    if email is not None:
        to_encode["email"] = str(email)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = add_token_claims(
        {
            "exp": expire,
            "sub": str(subject),
            "type": "refresh",
        }
    )

    encoded_jwt = jwt.encode(to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_reset_token(subject: Union[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a password reset token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = add_token_claims(
        {
            "exp": expire,
            "sub": str(subject),
            "type": "reset",
        }
    )

    encoded_jwt = jwt.encode(to_encode, settings.JWT_RESET_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_verification_token(subject: Union[str, Any], expires_delta: timedelta | None = None) -> str:
    """
    Create an email verification token with enhanced security.

    Includes:
    - Unique token ID to prevent replay attacks
    - Not-before time validation
    - Standard claims (iss, aud, iat)
    - Additional entropy
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES)
    )

    to_encode = add_token_claims(
        {
            "exp": expire,
            "sub": str(subject),
            "type": "verification",
            "entropy": base64.urlsafe_b64encode(os.urandom(16)).decode(),
        }
    )

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_VERIFICATION_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_token(
    token: str,
    *,
    token_type: Literal["access", "refresh", "reset", "verification"] = "access",
    verify_type: bool = True,
    verify_exp: bool = True,
    leeway: int = 0,
) -> dict[str, Any]:
    """
    Decode and validate a JWT token with enhanced security checks.
    """
    try:
        # Select appropriate key based on token type
        key = {
            "access": settings.SECRET_KEY,
            "refresh": settings.JWT_REFRESH_SECRET_KEY,
            "reset": settings.JWT_RESET_SECRET_KEY,
            "verification": settings.JWT_VERIFICATION_SECRET_KEY,
        }[token_type]

        # Basic format validation
        if not token or not isinstance(token, str) or "." not in token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token format")

        try:
            # Full token validation
            payload = jwt.decode(
                token,
                key,
                algorithms=[JWT_ALGORITHM],
                audience=settings.TOKEN_AUDIENCE,
                issuer=settings.TOKEN_ISSUER,
                options={
                    "verify_exp": verify_exp,
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                    "leeway": leeway,
                },
            )
        except JWTError as e:
            error_type = type(e).__name__
            if "ExpiredSignature" in error_type:
                detail = "Token has expired"
            elif "ImmatureSignature" in error_type:
                detail = "Token not yet valid"
            elif "InvalidAudience" in error_type:
                detail = "Invalid token audience"
            elif "InvalidIssuer" in error_type:
                detail = "Invalid token issuer"
            else:
                detail = "Invalid token"

            logger.warning(f"JWT validation failed: {str(e)}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

        # Token type validation
        if verify_type and payload.get("type") != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type} token.",
            )

        # Additional claim validation
        validate_token_claims(payload)

        return payload

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token validation failed")


def validate_token_claims(payload: dict) -> None:
    """Verify required token claims and values."""
    required_claims = {"sub", "iat", "exp", "iss", "aud", "type", "jti", "nbf"}
    missing_claims = required_claims - payload.keys()
    if missing_claims:
        # Log missing claims for detailed debugging
        logger.warning(
            f"Token validation failed: Missing required claims: {missing_claims}. Payload: {payload}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Missing required claims: {missing_claims}"
        )

    # Allow 5 minutes clock skew for issued at time
    now_ts = datetime.now(timezone.utc).timestamp()
    iat_val = payload.get("iat")

    if not isinstance(iat_val, (int, float)):
        logger.error(f"IAT claim is not numeric! Value: {iat_val}, Type: {type(iat_val)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid IAT format in token")

    condition_met = iat_val > now_ts + 300

    if condition_met:
        logger.warning(
            f"Invalid token issue time: iat ({iat_val}) is greater than now_ts + 300 ({now_ts + 300})"
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issue time")


class PasswordValidator:
    """Password validation helper class."""

    @staticmethod
    def validate_complexity(password: str) -> tuple[bool, list[str]]:
        """
        Validate password complexity according to settings.
        Returns a tuple of (is_valid, list of error messages).
        """
        errors = []

        if len(password) < settings.PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")

        if len(password) > settings.PASSWORD_MAX_LENGTH:
            errors.append(f"Password must not exceed {settings.PASSWORD_MAX_LENGTH} characters")

        if settings.PASSWORD_REQUIRE_UPPERCASE and not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")

        if settings.PASSWORD_REQUIRE_LOWERCASE and not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")

        if settings.PASSWORD_REQUIRE_DIGITS and not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")

        if settings.PASSWORD_REQUIRE_SPECIAL:
            if not any(c in settings.PASSWORD_SPECIAL_CHARS for c in password):
                errors.append(
                    "Password must contain at least one special character from: "
                    f"{settings.PASSWORD_SPECIAL_CHARS}"
                )

        if settings.PREVENT_COMMON_PASSWORDS and password.lower() in settings.COMMON_PASSWORDS:
            errors.append("This password is too common. Please choose a stronger password")

        if settings.PREVENT_SEQUENTIAL_CHARS and PasswordValidator.has_sequential_chars(password):
            errors.append(
                "Password contains sequential characters (e.g., 123, abc). "
                "Please use a more random combination"
            )

        if settings.PREVENT_REPEATED_CHARS and PasswordValidator.has_repeated_chars(password):
            errors.append("Password contains too many repeated characters")

        return len(errors) == 0, errors

    @staticmethod
    def has_sequential_chars(password: str, sequence_length: int = 3) -> bool:
        """Check if password contains sequential characters."""
        sequences = ("abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789")

        for sequence in sequences:
            for i in range(len(sequence) - sequence_length + 1):
                if sequence[i : i + sequence_length] in password:  # noqa: E203
                    return True
                if sequence[i : i + sequence_length][::-1] in password:  # noqa: E203
                    return True
        return False

    @staticmethod
    def has_repeated_chars(password: str, max_repeats: int = 3) -> bool:
        """Check if password has too many repeated characters."""
        count = 1
        prev_char = None

        for char in password:
            if char == prev_char:
                count += 1
                if count > max_repeats:
                    return True
            else:
                count = 1
            prev_char = char
        return False

    @staticmethod
    def get_password_hash(plain_password: str | bytes) -> str:
        """
        Hash a password with bcrypt with enhanced security.

        - Uses a high work factor for bcrypt
        - Adds pepper if configured
        - Pre-processes password with HMAC if configured
        """
        if isinstance(plain_password, str):
            plain_password = plain_password.encode()

        try:
            # Add pepper if configured
            if settings.PASSWORD_PEPPER:
                plain_password = hmac.new(
                    settings.PASSWORD_PEPPER.encode(), plain_password, hashlib.sha256
                ).digest()

            # Use configured work factor for bcrypt
            salt = bcrypt.gensalt(rounds=settings.PASSWORD_HASHING_ITERATIONS)
            return bcrypt.hashpw(plain_password, salt).decode()
        except Exception as e:
            logger.error(f"Password hashing failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to process password"
            )

    @staticmethod
    def verify_password(plain_password: str | bytes, hashed_password: str | bytes) -> bool:
        """Verify a password against its hash."""
        try:
            if isinstance(plain_password, str):
                plain_password = plain_password.encode()
            if isinstance(hashed_password, str):
                hashed_password = hashed_password.encode()

            # Add pepper if configured
            if settings.PASSWORD_PEPPER:
                plain_password = hmac.new(
                    settings.PASSWORD_PEPPER.encode(), plain_password, hashlib.sha256
                ).digest()

            return bcrypt.checkpw(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Password verification failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to verify password"
            )


def get_data_encrypt(data: str | bytes) -> str:
    """Encrypt data using Fernet."""
    if isinstance(data, str):
        data = data.encode()
    encrypted = fernet.encrypt(data)
    return encrypted.decode()


def get_content(variable: str) -> str:
    """Decrypt data using Fernet."""
    try:
        decrypted = fernet.decrypt(variable.encode())
        return decrypted.decode()
    except Exception as e:
        logger.error(f"Data decryption failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to decrypt data"
        )
