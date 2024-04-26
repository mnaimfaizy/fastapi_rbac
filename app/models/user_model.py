from datetime import datetime
from typing import Optional

from pydantic import EmailStr
from sqlmodel import Column, Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel
from app.models.user_role_model import UserRole


class UserBase(SQLModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr = Field(sa_column=Column(String, unique=True, index=True))
    password: str
    is_active: bool = True
    is_superuser: bool = False
    last_updated_by: int | None = None
    needsToChangePassword: bool = True
    expiry_date: datetime | None
    contact_phone: str | None = None
    last_changed_password_date: datetime | None
    number_of_failed_attempts: int | None = None
    verified: bool = False
    verification_code: str | None = None


class User(BaseUUIDModel, UserBase, table=True):
    first_name: Optional[str] | None = Field(index=True)
    last_name: Optional[str] | None = Field(index=True)
    expiry_date: datetime | None = Field(default_factory=datetime.utcnow)
    last_changed_password_date: datetime | None = Field(default_factory=datetime.utcnow)
    roles: list["Role"] = Relationship(
        back_populates="users",
        link_model=UserRole,
        sa_relationship_kwargs={"lazy": "joined"},
    )
