from uuid import UUID

from app.models.base_uuid_model import BaseUUIDModel
from sqlmodel import Field


class RolePermission(BaseUUIDModel, table=True):
    role_id: UUID | None = Field(
        foreign_key="Role.id",
        primary_key=True,
        index=True,
    )
    permission_id: UUID | None = Field(
        foreign_key="Permission.id",
        primary_key=True,
        index=True,
    )
