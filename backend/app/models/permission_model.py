from typing import Optional
from uuid import UUID

from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_permission_model import RolePermission


class PermissionBase(SQLModel):
    name: str | None = None
    description: str | None = None
    group_id: int


class Permission(BaseUUIDModel, PermissionBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    description: str | None = Field(String(250), nullable=True, index=True)
    group_id: UUID = Field(foreign_key="PermissionGroup.id")
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    roles: Optional[list["Role"]] = Relationship(
        back_populates="permissions",
        link_model=RolePermission,
        sa_relationship_kwargs={"lazy": "joined"},
    )
    groups: list["PermissionGroup"] = Relationship(
        back_populates="permissions", sa_relationship_kwargs={"lazy": "joined"}
    )
