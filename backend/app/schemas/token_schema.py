from pydantic import BaseModel, EmailStr

from .user_schema import IUserRead


class Token(BaseModel):
    access_token: str
    token_type: str
    # Refresh token is delivered via HttpOnly cookie for the first-party SPA.
    # Optional body field retained for non-browser API clients when documented.
    refresh_token: str | None = None
    user: IUserRead


class TokenRead(BaseModel):
    access_token: str
    token_type: str


class RefreshToken(BaseModel):
    # Prefer HttpOnly cookie; body is a documented fallback for non-browser clients.
    refresh_token: str | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
