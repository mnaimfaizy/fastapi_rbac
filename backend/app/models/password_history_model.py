from typing import Optional
from uuid import UUID

from sqlmodel import Field, SQLModel

from app.models.base_uuid_model import BaseUUIDModel


class UserPasswordHistoryBase(SQLModel):
    user_id: Optional[UUID] = None
    password: Optional[str] = None


class UserPasswordHistory(BaseUUIDModel, UserPasswordHistoryBase, table=True):
    user_id: UUID = Field(foreign_key="User.id")
