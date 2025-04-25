from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user_model import User, UserBase
from app.utils.partial import optional


# Properties to receive via API on creation
class IUserCreate(UserBase):
    role_id: Optional[List[UUID]] = None
    password: Optional[str] = None
    last_changed_password_date: Optional[datetime] = None
    expiry_date: datetime | None = None
    number_of_failed_attempts: int = 0  # Adding the missing field with default value


# Properties to receive via API on update
@optional()
class IUserUpdate(UserBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    role_id: Optional[List[UUID]] = None
    contact_phone: Optional[str] = None
    expiry_date: Optional[datetime] = None
    password: Optional[str] = None  # For allowing password update via this endpoint


class IUserRead(UserBase):
    id: UUID
    roles: Optional[List[str]] = None


@optional()
class IUserOutput(BaseModel):

    class Config:
        smart_union: True


class IUserOutputPaginated(BaseModel):
    data: Optional[List[User]] = None
    total: Optional[int] = None
    count: Optional[int] = None
    pagination: Dict[str, Any] = None


class IUserOutputPaginatedSchema(BaseModel):
    data: Optional[IUserOutputPaginated]
    status: Optional[str]
    message: Optional[str]


class IUserLoginSchema(BaseModel):
    id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = False
    verified: Optional[bool] = False
    is_superuser: Optional[bool] = False
    needs_to_change_password: Optional[bool] = False
    expiry_date: Optional[datetime] = None
    contact_phone: Optional[str] = None
    number_of_failed_attempts: Optional[int] = None
    role: Optional[List[str]] = None
    permissions: Optional[List[str]] = None


class IUserPasswordReset(BaseModel):
    is_active: Optional[bool] = None
    needs_to_change_password: Optional[bool] = None
    expiry_date: Optional[datetime] = None


class IUserStatus(str, Enum):
    active: "active"
    inactive: "inactive"


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
