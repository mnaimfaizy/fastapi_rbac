from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List

from pydantic import EmailStr, validator  # Modified import
from sqlmodel import Column, Field, Relationship, String

from app.models.base_uuid_model import BaseUUIDModel, SQLModel
from app.models.user_role_model import UserRole

if TYPE_CHECKING:
    from app.models.permission_group_model import PermissionGroup
    from app.models.permission_model import Permission
    from app.models.role_model import Role


class UserBase(SQLModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr = Field(sa_column=Column(String, unique=True, index=True))
    is_active: bool = True
    is_superuser: bool = False
    last_updated_by: int | None = None  # Assuming str or UUID, keeping as int for now.
    needs_to_change_password: bool = True
    expiry_date: datetime | None = None
    contact_phone: str | None = None
    last_changed_password_date: datetime | None = None
    number_of_failed_attempts: int | None = None
    is_locked: bool = False
    locked_until: datetime | None = None
    verified: bool = False
    verification_code: str | None = None

    @validator("expiry_date", "last_changed_password_date", "locked_until", pre=True)
    def convert_null_string_to_none(cls, v: Any) -> Any:
        if isinstance(v, str) and v.upper() == "(NULL)":  # Made case-insensitive
            return None
        return v


class User(BaseUUIDModel, UserBase, table=True):
    """User model for the application."""

    __tablename__ = "User"

    first_name: str | None = Field(default=None, index=True)
    last_name: str | None = Field(default=None, index=True)
    password: str | None = Field(default=None)  # Store the hashed password
    expiry_date: datetime | None = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_changed_password_date: datetime | None = Field(default_factory=lambda: datetime.now(timezone.utc))
    roles: List["Role"] = Relationship(
        back_populates="users",
        link_model=UserRole,
        sa_relationship_kwargs={
            "lazy": "selectin"
        },  # Changed from 'joined' to 'selectin' for better performance
    )

    created_permissions: List["Permission"] = Relationship(
        back_populates="created_by",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "User.id == Permission.created_by_id",
            "foreign_keys": "[Permission.created_by_id]",
        },
    )

    created_permission_groups: List["PermissionGroup"] = Relationship(
        back_populates="creator",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "User.id == PermissionGroup.created_by_id",
            "foreign_keys": "[PermissionGroup.created_by_id]",
        },
    )

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def role_names(self) -> list[str]:
        """Get list of role names for serialization"""
        return [role.name for role in self.roles] if self.roles else []

    def model_dump(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        """Override model_dump to customize role serialization"""
        data = super().model_dump(*args, **kwargs)
        # Always serialize roles as objects with id and name
        data["roles"] = (
            [
                {
                    "id": str(role.id),  # Ensure UUID is converted to string
                    "name": role.name,
                    "description": role.description,
                }
                for role in self.roles
            ]
            if self.roles
            else []
        )
        return data
