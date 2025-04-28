from datetime import datetime
from typing import Any, Dict
from uuid import UUID, uuid4

from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    """Model for storing security audit logs"""

    __tablename__ = "AuditLog"  # Updated to match the actual case in the database

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    actor_id: UUID = Field(...)
    action: str = Field(...)
    resource_type: str = Field(...)
    resource_id: str = Field(...)
    details: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
