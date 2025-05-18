from typing import TYPE_CHECKING, List
from uuid import UUID

from sqlalchemy.orm import backref
from sqlmodel import Field, Relationship, SQLModel, String

from app.models.base_uuid_model import BaseUUIDModel

if TYPE_CHECKING:
    from app.models.permission_model import Permission
    from app.models.user_model import User


class PermissionGroupBase(SQLModel):
    name: str | None = Field(String(250), nullable=True, index=True)
    permission_group_id: UUID | None = None


class PermissionGroup(BaseUUIDModel, PermissionGroupBase, table=True):
    """PermissionGroup model for the application."""

    __tablename__ = "PermissionGroup"

    created_by_id: UUID | None = Field(
        default=None, foreign_key="User.id"
    )  # Fixed case: User instead of user
    permission_group_id: UUID | None = Field(
        default=None, foreign_key="PermissionGroup.id", nullable=True, index=True
    )

    # Fix the self-referential relationship with explicit primaryjoin
    groups: List["PermissionGroup"] = Relationship(
        sa_relationship_kwargs=dict(
            lazy="selectin",
            cascade="all,delete",
            primaryjoin="PermissionGroup.id == foreign(PermissionGroup.permission_group_id)",
            backref=backref("parent", remote_side="PermissionGroup.id", lazy="joined"),
        )
    )

    # Fixed the relationship - removed foreign() as it was causing the relationship loading issue
    permissions: List["Permission"] = Relationship(
        back_populates="group",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "Permission.group_id == PermissionGroup.id",
        },
    )

    creator: "User" = Relationship(
        back_populates="created_permission_groups",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "primaryjoin": "PermissionGroup.created_by_id == User.id",
            "foreign_keys": "[PermissionGroup.created_by_id]",
        },
    )
