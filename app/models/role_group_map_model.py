from uuid import UUID

from sqlmodel import Field

from app.models.base_uuid_model import BaseUUIDModel


class RoleGroupMap(BaseUUIDModel, table=True):
    role_group_id: UUID = Field(
        foreign_key="RoleGroup.id",
        primary_key=True,
        index=True,
    )
    role_id: UUID = Field(
        foreign_key="Role.id",
        primary_key=True,
        index=True,
    )
