from datetime import datetime
from enum import Enum
from typing import Any, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user_model import User, UserBase
from app.utils.partial import optional


# Properties to receive via API on creation
class IUserCreate(UserBase):
    role_id: list[UUID] | None = None
    password: str | None = None
    last_changed_password_date: datetime | None = None
    expiry_date: datetime | None = None
    number_of_failed_attempts: int = 0  # Adding the missing field with default value


# Properties to receive via API on update
@optional()
class IUserUpdate(UserBase):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    role_id: list[UUID] | None = None
    contact_phone: str | None = None
    expiry_date: datetime | None = None
    password: str | None = None  # For allowing password update via this endpoint


class IUserRead(UserBase):
    id: UUID
    roles: list[str] | None = None


@optional()
class IUserOutput(BaseModel):

    model_config = {"smart_union": True}


class IUserOutputPaginated(BaseModel):
    data: list[User] | None = None
    total: int | None = None
    count: int | None = None
    pagination: dict[str, Any] = {}


class IUserOutputPaginatedSchema(BaseModel):
    data: IUserOutputPaginated | None = None
    status: str | None = None
    message: str | None = None


class IUserLoginSchema(BaseModel):
    id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    is_active: bool = False
    verified: bool = False
    is_superuser: bool = False
    needs_to_change_password: bool = False
    expiry_date: datetime | None = None
    contact_phone: str | None = None
    number_of_failed_attempts: int | None = None
    role: list[str] | None = None
    permissions: list[str] | None = None


class IUserPasswordReset(BaseModel):
    is_active: bool | None = None
    needs_to_change_password: bool | None = None
    expiry_date: datetime | None = None


class IUserStatus(str, Enum):
    active = "active"
    inactive = "inactive"


# Schemas for password reset functionality
class PasswordResetRequest(BaseModel):
    """Schema for requesting a password reset"""

    email: EmailStr = Field(
        ..., description="Email address of the user requesting password reset"
    )


class PasswordResetConfirm(BaseModel):
    """Schema for confirming a password reset with token"""

    token: str = Field(..., description="Reset token received via email")
    new_password: str = Field(..., min_length=8, description="New password to set")
