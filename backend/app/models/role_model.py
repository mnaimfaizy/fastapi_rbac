from typing import TYPE_CHECKING, List
from uuid import UUID

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_group_map_model import RoleGroupMap
from app.models.role_permission_model import RolePermission
from app.models.user_role_model import UserRole
from sqlmodel import Field, Relationship, SQLModel, String

if TYPE_CHECKING:
    from app.models.permission_model import Permission
    from app.models.role_group_model import RoleGroup
    from app.models.user_model import User


class RoleBase(SQLModel):
    name: str | None = None
    description: str | None = None


class Role(BaseUUIDModel, RoleBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    description: str | None = Field(String(250), nullable=True, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    permissions: List["Permission"] = Relationship(
        link_model=RolePermission,
        back_populates="roles",
        sa_relationship_kwargs={"lazy": "joined"},
    )
    users: List["User"] = Relationship(
        back_populates="roles",
        link_model=UserRole,
        sa_relationship_kwargs={"lazy": "joined"},
    )
    groups: List["RoleGroup"] = Relationship(
        back_populates="roles",
        link_model=RoleGroupMap,
        sa_relationship_kwargs={"lazy": "joined"},
    )
