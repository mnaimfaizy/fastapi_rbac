from typing import TYPE_CHECKING, List
from uuid import UUID

from sqlalchemy.orm import backref
from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_group_map_model import RoleGroupMap

if TYPE_CHECKING:
    from app.models.role_model import Role
    from app.models.user_model import User


class RoleGroupBase(SQLModel):
    name: str | None = None
    parent_id: UUID | None = None


class RoleGroup(BaseUUIDModel, RoleGroupBase, table=True):
    __tablename__ = "RoleGroup"  # type: ignore[assignment]

    name: str | None = Field(String(250), nullable=True, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    parent_id: UUID | None = Field(default=None, foreign_key="RoleGroup.id", nullable=True)

    # Relationships with eager loading and proper backref configuration
    roles: List["Role"] = Relationship(
        link_model=RoleGroupMap,
        back_populates="groups",
        sa_relationship_kwargs={"lazy": "selectin", "overlaps": "children,parent"},
    )

    children: List["RoleGroup"] = Relationship(
        sa_relationship_kwargs=dict(
            lazy="selectin",
            cascade="all",
            backref=backref("parent", remote_side="RoleGroup.id", lazy="joined", overlaps="roles"),
        )
    )

    creator: "User" = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "foreign_keys": "RoleGroup.created_by_id",
        }
    )
