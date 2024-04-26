from uuid import UUID

from sqlalchemy.orm import backref
from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel


class PermissionGroupBase(SQLModel):
    name: str | None = None
    permission_group_id: UUID | None


class PermissionGroup(BaseUUIDModel, PermissionGroupBase, table=True):
    name: str | None = Field(String(250), nullable=True, index=True)
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    permission_group_id: UUID | None = Field(
        UUID, foreign_key="PermissionGroup.id", nullable=True, index=True
    )
    groups: list["PermissionGroup"] = Relationship(
        sa_relationship_kwargs=dict(
            lazy="joined",
            cascade="all",
            backref=backref("parent", remote_side="PermissionGroup.id"),
        )
    )
    permissions: list["Permission"] = Relationship(
        sa_relationship_kwargs={"lazy": "joined"}, back_populates="groups"
    )
