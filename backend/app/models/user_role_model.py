from uuid import UUID

from sqlmodel import Field

from app.models.base_uuid_model import BaseUUIDModel


class UserRole(BaseUUIDModel, table=True):
    """Many-to-many relationship between Users and Roles with a composite primary key."""

    __tablename__ = "UserRole"

    user_id: UUID = Field(foreign_key="User.id", primary_key=True)
    role_id: UUID = Field(foreign_key="Role.id", primary_key=True)
