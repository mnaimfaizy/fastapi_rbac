from typing import TYPE_CHECKING, List
from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm.mapper import Mapper
from sqlmodel import Field, Relationship, SQLModel

from app.models.base_uuid_model import BaseUUIDModel
from app.models.role_group_map_model import RoleGroupMap
from app.models.role_permission_model import RolePermission
from app.models.user_role_model import UserRole

if TYPE_CHECKING:
    from app.models.permission_model import Permission
    from app.models.role_group_model import RoleGroup
    from app.models.user_model import User


class RoleBase(SQLModel):
    name: str | None = None
    description: str | None = None
    role_group_id: UUID | None = None


class Role(BaseUUIDModel, RoleBase, table=True):
    name: str | None = Field(default=None, max_length=250, nullable=True, index=True)
    description: str | None = Field(default=None, nullable=True, index=True)
    role_group_id: UUID | None = Field(
        default=None, foreign_key="RoleGroup.id", nullable=True
    )
    created_by_id: UUID | None = Field(default=None, foreign_key="User.id")
    permissions: List["Permission"] = Relationship(
        link_model=RolePermission,
        back_populates="roles",
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    users: List["User"] = Relationship(
        back_populates="roles",
        link_model=UserRole,
        sa_relationship_kwargs={"lazy": "selectin"},
    )
    groups: List["RoleGroup"] = Relationship(
        back_populates="roles",
        link_model=RoleGroupMap,
        sa_relationship_kwargs={"lazy": "selectin", "overlaps": "children,parent"},
    )


# Event listeners to keep role_group_id and RoleGroupMap synchronized
@event.listens_for(Role, "after_insert")
def after_insert_role(mapper: Mapper, connection: Connection, target: "Role") -> None:
    # If role_group_id is set on creation, ensure RoleGroupMap is created
    if target.role_group_id:
        # Check if mapping already exists
        query = text(
            'SELECT 1 FROM "RoleGroupMap" WHERE role_id = :role_id AND role_group_id = :role_group_id'
        )
        params = {"role_id": str(target.id), "role_group_id": str(target.role_group_id)}
        existing = connection.execute(query, params).fetchone()

        if not existing:
            # Create new mapping
            insert_query = text(
                'INSERT INTO "RoleGroupMap" (role_id, role_group_id) VALUES (:role_id, :role_group_id)'
            )
            connection.execute(insert_query, params)


@event.listens_for(Role, "after_update")
def after_update_role(mapper: Mapper, connection: Connection, target: "Role") -> None:
    # If role_group_id was changed
    if target.role_group_id:
        # Check if mapping already exists
        query = text(
            'SELECT 1 FROM "RoleGroupMap" WHERE role_id = :role_id AND role_group_id = :role_group_id'
        )
        params = {"role_id": str(target.id), "role_group_id": str(target.role_group_id)}
        existing = connection.execute(query, params).fetchone()

        if not existing:
            # Create new mapping
            insert_query = text(
                'INSERT INTO "RoleGroupMap" (role_id, role_group_id) VALUES (:role_id, :role_group_id)'
            )
            connection.execute(insert_query, params)

    # If role_group_id was removed, remove any mappings
    if not target.role_group_id:
        delete_query = text('DELETE FROM "RoleGroupMap" WHERE role_id = :role_id')
        connection.execute(delete_query, {"role_id": str(target.id)})
