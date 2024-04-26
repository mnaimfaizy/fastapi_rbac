from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.models.user_model import User, UserBase
from app.utils.partial import optional


# Properties to receive via API on creation
class IUserCreate(UserBase):
    role_id: Optional[List[UUID]] = None
    password: Optional[str] = None
    last_changed_password_date: Optional[datetime] = None
    expiry_date: datetime | None = None


# Properties to receive via API on update
@optional()
class IUserUpdate(UserBase):
    pass


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
