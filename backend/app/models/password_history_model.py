from typing import Optional
from uuid import UUID

from app.models.base_uuid_model import BaseUUIDModel
from sqlmodel import Field, SQLModel


class UserPasswordHistoryBase(SQLModel):
    user_id: Optional[UUID] = None
    password: Optional[str] = None


class UserPasswordHistory(BaseUUIDModel, UserPasswordHistoryBase, table=True):
    user_id: UUID = Field(foreign_key="User.id")
