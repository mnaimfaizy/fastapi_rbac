from datetime import datetime, timedelta
from typing import Any, Union

import bcrypt
from cryptography.fernet import Fernet
from jose import jwt

from app.core.config import settings

fernet = Fernet(str.encode(settings.ENCRYPT_KEY))

JWT_ALGORITHM = settings.ALGORITHM


def create_access_token(
    subject: Union[str, Any],
    email: Union[str, Any],
    expires_delta: timedelta = None,
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "email": str(email),
        "iat": datetime.utcnow(),
        "iss": settings.TOKEN_ISSUER,
        "aud": settings.TOKEN_AUDIENCE,
    }
    encoded_jwt = jwt.encode(to_encode, settings.ENCRYPT_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta is not None:
        expires_delta = datetime.utcnow() + expires_delta
    else:
        expires_delta = datetime.utcnow() + timedelta(
            minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "exp": expires_delta,
        "sub": str(subject),
        "iat": datetime.utcnow(),
        "iss": settings.TOKEN_ISSUER,
        "aud": settings.TOKEN_AUDIENCE,
    }
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_REFRESH_SECRET_KEY, algorithm=JWT_ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token=token,
        key=settings.ENCRYPT_KEY,
        algorithms=[JWT_ALGORITHM],
        audience=settings.TOKEN_AUDIENCE,
        issuer=settings.TOKEN_ISSUER,
    )


def verify_password(plain_password: str | bytes, hashed_password: str | bytes) -> bool:
    if isinstance(plain_password, str):
        plain_password = plain_password.encode()
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode()

    return bcrypt.checkpw(plain_password, hashed_password)


def get_password_hash(plain_password: str | bytes) -> str:
    if isinstance(plain_password, str):
        plain_password = plain_password.encode()

    return bcrypt.hashpw(plain_password, bcrypt.gensalt()).decode()


def get_data_encrypt(data) -> str:
    data = fernet.encrypt(data)
    return data.decode()


def get_content(variable: str) -> str:
    return fernet.decrypt(variable.encode()).decode()
