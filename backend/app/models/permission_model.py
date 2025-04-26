from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_permission_model import RolePermission

if TYPE_CHECKING:
    from app.models.permission_group_model import PermissionGroup
    from app.models.role_model import Role


class PermissionBase(SQLModel):
    name: str | None = None
    description: str | None = None
    group_id: int


class Permission(BaseUUIDModel, PermissionBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    description: str | None = Field(String(250), nullable=True, index=True)
    group_id: UUID = Field(foreign_key="PermissionGroup.id")
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    roles: Optional[List["Role"]] = Relationship(
        back_populates="permissions",
        link_model=RolePermission,
        sa_relationship_kwargs={"lazy": "joined"},
    )
    groups: List["PermissionGroup"] = Relationship(
        back_populates="permissions", sa_relationship_kwargs={"lazy": "joined"}
    )
