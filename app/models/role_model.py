from uuid import UUID

from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_group_map_model import RoleGroupMap
from app.models.role_permission_model import RolePermission
from app.models.user_role_model import UserRole


class RoleBase(SQLModel):
    name: str | None = None
    description: str | None = None


class Role(BaseUUIDModel, RoleBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    description: str | None = Field(String(250), nullable=True, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    permissions: list["Permission"] = Relationship(
        link_model=RolePermission,
        back_populates="roles",
        sa_relationship_kwargs={"lazy": "joined"},
    )
    users: list["User"] = Relationship(
        back_populates="roles",
        link_model=UserRole,
        sa_relationship_kwargs={"lazy": "joined"},
    )
    groups: list["RoleGroup"] = Relationship(
        back_populates="roles",
        link_model=RoleGroupMap,
        sa_relationship_kwargs={"lazy": "joined"},
    )
