from datetime import datetime
from enum import Enum
from typing import Any, List  # Added List import back
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field  # Added ConfigDict import

from app.models.user_model import User, UserBase
from app.utils.partial import optional

# Removed unused SQLModel import


# Properties to receive via API on creation
class IUserCreate(UserBase):
    role_id: list[UUID] | None = None
    # Password is required on creation as per UserBase
    password: str
    last_changed_password_date: datetime | None = None
    expiry_date: datetime | None = None
    number_of_failed_attempts: int | None = 0  # Adding the missing field with default value
    verified: bool = False  # Add verified field, default to False
    roles: list[dict[str, Any]] | None = None  # Adding roles field


# Properties for user registration
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str | None = None
    last_name: str | None = None


# Properties for email verification
class VerifyEmail(BaseModel):
    token: str


# Properties to receive via API on update
@optional()
class IUserUpdate(UserBase):
    # Let @optional handle making fields optional, remove conflicting '| None'
    first_name: str
    last_name: str
    email: EmailStr
    is_active: bool
    is_superuser: bool
    role_id: list[UUID] | None = None
    contact_phone: str | None = None
    expiry_date: datetime | None = None
    # Password update is optional - handled by @optional
    password: str


class IUserRead(UserBase):
    id: UUID
    roles: list[dict[str, Any]]  # Change to accept role objects instead of strings
    permissions: list[str] | None = []  # Add permissions field

    # This usage is standard for Pydantic v2/SQLModel
    model_config = {  # Changed from SQLModel.Config(...) to a dictionary
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "e7954260-7873-4f90-836a-30eda72b89b8",
                "email": "user@example.com",
                "is_active": True,
                "is_superuser": False,
                "first_name": "John",
                "last_name": "Doe",
                "roles": [
                    {
                        "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
                        "name": "user",
                        "description": "A standard user",
                        "permissions": [
                            {
                                "id": "09876543-2109-8765-4321-fedcba098765",
                                "name": "read_own_data",
                                "description": "Can read own data",
                                "group_id": "g1h2i3j4-k5l6-m7n8-o9p0-q1r2s3t4u5v6",
                            }
                        ],
                        "role_group_id": "r1s2t3u4-v5w6-x7y8-z9a0-b1c2d3e4f5g6",
                    }
                ],
                "permissions": ["read_own_data"],  # Added example for permissions
            }
        },
    }


@optional()
class IUserOutput(BaseModel):
    model_config = ConfigDict({})


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


class INewPassword(BaseModel):
    password: str = Field(..., min_length=8, description="New password to set")
    token: str = Field(..., description="Reset token received via email")


class IUserStatus(str, Enum):
    active = "active"
    inactive = "inactive"


class IVerifyEmail(BaseModel):
    token: str = Field(..., description="Verification token received via email")
    email: EmailStr = Field(..., description="Email address of the user to verify")


# Schemas for password reset functionality
class PasswordResetRequest(BaseModel):
    """Schema for requesting a password reset"""

    email: EmailStr = Field(..., description="Email address of the user requesting password reset")


class PasswordResetConfirm(BaseModel):
    """Schema for confirming a password reset with token"""

    token: str = Field(..., description="Reset token received via email")
    new_password: str = Field(..., min_length=8, description="New password to set")


class IUserRoleAssign(BaseModel):
    user_id: str
    role_ids: List[str]
