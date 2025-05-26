from datetime import datetime
from uuid import UUID

from sqlmodel import Field, SQLModel

from app.models.base_uuid_model import BaseUUIDModel


class UserPasswordHistoryBase(SQLModel):
    user_id: UUID = Field(default=None, foreign_key="User.id", index=True)
    password_hash: str
    salt: str = Field(default="")  # For future use with per-password salts
    pepper_used: bool = Field(default=False)  # Track if pepper was used
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    created_by_ip: str | None = Field(default=None)  # Track source of change
    reset_token_id: UUID | None = Field(default=None)  # Link to reset token if used


class UserPasswordHistory(BaseUUIDModel, UserPasswordHistoryBase, table=True):
    """Track password changes for compliance and security.

    This helps prevent password reuse and provides audit trail.
    """

    __tablename__ = "UserPasswordHistory"  # type: ignore[assignment]
