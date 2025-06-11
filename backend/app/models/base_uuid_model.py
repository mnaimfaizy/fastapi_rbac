from datetime import datetime, timezone
from uuid import UUID

from pydantic import field_validator  # Updated to use field_validator from Pydantic V2
from sqlalchemy.orm import declared_attr
from sqlmodel import Field
from sqlmodel import SQLModel as _SQLModel

from app.utils.uuid6 import uuid7


# id: implements proposal uuid7 draft4
class SQLModel(_SQLModel):
    @declared_attr  # type: ignore
    def __tablename__(cls) -> str:  # type: ignore
        return cls.__name__


class BaseUUIDModel(SQLModel):
    id: UUID = Field(
        default_factory=uuid7,
        primary_key=True,
        index=True,
        nullable=False,
    )
    updated_at: datetime = Field(  # Made non-nullable
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": datetime.utcnow},
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)  # Made non-nullable

    @field_validator("created_at", "updated_at", mode="before")  # Updated to use field_validator
    @classmethod  # Required for class methods in Pydantic V2
    def fix_null_string_for_datetime(cls, v: str | None | datetime) -> datetime:  # Changed type hint for v
        if isinstance(v, str) and v.upper() == "(NULL)":  # Make check case-insensitive
            return datetime.now(timezone.utc)
        if v is None:  # If it's already None (e.g. from DB NULL), and field is non-nullable, provide default
            return datetime.now(timezone.utc)
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                # Attempt to parse if it's a string but not "(NULL)"
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except ValueError:
                return datetime.now(timezone.utc)
        # If v is not str, None, or datetime, it's an unexpected type
        raise TypeError(f"Unexpected type for v: {type(v)}. Expected str, None, or datetime.")
