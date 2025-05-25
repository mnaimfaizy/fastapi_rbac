from datetime import datetime
from typing import Any, Dict
from uuid import UUID

from sqlalchemy import JSON
from sqlmodel import Field, SQLModel

from app.models.base_uuid_model import BaseUUIDModel


class AuditLogBase(SQLModel):
    actor_id: UUID = Field(...)
    action: str = Field(...)
    resource_type: str = Field(...)
    resource_id: str = Field(...)
    details: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(BaseUUIDModel, AuditLogBase, table=True):
    """Model for storing security audit logs"""

    __tablename__ = "AuditLog"  # type: ignore[assignment]

    class Config:
        arbitrary_types_allowed = True
