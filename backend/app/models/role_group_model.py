from typing import TYPE_CHECKING, List
from uuid import UUID

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_group_map_model import RoleGroupMap
from sqlmodel import Field, Relationship, SQLModel, String

if TYPE_CHECKING:
    from app.models.role_model import Role


class RoleGroupBase(SQLModel):
    name: str | None = None


class RoleGroup(BaseUUIDModel, RoleGroupBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    roles: List["Role"] = Relationship(
        link_model=RoleGroupMap,
        back_populates="groups",
        sa_relationship_kwargs={"lazy": "joined"},
    )
