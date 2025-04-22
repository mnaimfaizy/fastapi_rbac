from pydantic import BaseModel, EmailStr

from .user_schema import IUserRead


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str
    user: IUserRead


class TokenRead(BaseModel):
    access_token: str
    token_type: str


class RefreshToken(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
