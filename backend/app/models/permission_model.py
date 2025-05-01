from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlmodel import Field, Relationship, SQLModel

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_permission_model import RolePermission

if TYPE_CHECKING:
    from app.models.permission_group_model import PermissionGroup
    from app.models.role_model import Role
    from app.models.user_model import User


class PermissionBase(SQLModel):
    name: str = Field(index=True, unique=True, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    # Make the group_id non-nullable to match the actual database schema
    group_id: UUID = Field(foreign_key="PermissionGroup.id")


class Permission(BaseUUIDModel, PermissionBase, table=True):
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    created_by: Optional["User"] = Relationship(
        back_populates="created_permissions",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "Permission.created_by_id == User.id",
            "foreign_keys": "[Permission.created_by_id]",
        },
    )
    roles: Optional[List["Role"]] = Relationship(
        back_populates="permissions",
        link_model=RolePermission,
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    group: "PermissionGroup" = Relationship(
        back_populates="permissions",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "Permission.group_id == PermissionGroup.id",
        },
    )
