from datetime import datetime, timezone
from uuid import UUID

from pydantic import field_validator  # Updated to use field_validator from Pydantic V2
from sqlalchemy.orm import declared_attr
from sqlmodel import Field
from sqlmodel import SQLModel as _SQLModel

from app.utils.uuid6 import uuid7


# id: implements proposal uuid7 draft4
class SQLModel(_SQLModel):
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__


class BaseUUIDModel(SQLModel):
    id: UUID = Field(
        default_factory=uuid7,
        primary_key=True,
        index=True,
        nullable=False,
    )
    updated_at: datetime = Field(  # Made non-nullable
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))  # Made non-nullable

    @field_validator("created_at", "updated_at", mode="before")  # Updated to use field_validator
    @classmethod  # Required for class methods in Pydantic V2
    def fix_null_string_for_datetime(cls, v):
        if v == "(NULL)" or v is None:
            return datetime.now(timezone.utc)  # Default to current time instead of None
        return v
