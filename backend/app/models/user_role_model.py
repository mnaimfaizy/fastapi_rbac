from uuid import UUID

from app.models.base_uuid_model import BaseUUIDModel
from sqlmodel import Field


class UserRole(BaseUUIDModel, table=True):
    user_id: UUID | None = Field(
        default=None, foreign_key="User.id", primary_key=True, index=True
    )
    role_id: UUID | None = Field(
        default=None, foreign_key="Role.id", primary_key=True, index=True
    )
