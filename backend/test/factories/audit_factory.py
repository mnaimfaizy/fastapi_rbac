"""
Audit log and related model factories for testing.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, Type
from uuid import UUID

import factory
from factory import Faker
from factory.alchemy import SQLAlchemyModelFactory

from app.models.audit_log_model import AuditLog
from app.utils.uuid6 import uuid7


class AuditLogFactory(SQLAlchemyModelFactory):
    """Factory for creating AuditLog model instances."""

    class Meta:
        model = AuditLog
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid7)
    user_id = factory.LazyFunction(uuid7)  # Default to random UUID
    action = factory.Faker("word", ext_word_list=["create", "read", "update", "delete", "login", "logout"])
    resource_type = factory.Faker("word", ext_word_list=["user", "role", "permission", "group"])
    resource_id = factory.LazyFunction(uuid7)
    timestamp = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    ip_address = factory.Faker("ipv4")
    user_agent = factory.Faker("user_agent")
    status = factory.Faker("word", ext_word_list=["success", "failure", "pending"])

    @factory.lazy_attribute
    def details(self) -> str:
        """Generate a JSON-compatible details dictionary."""
        action_map: Dict[str, Dict[str, Any]] = {
            "create": {"new_values": {"name": Faker("name").evaluate(None, None, {})}},
            "update": {
                "old_values": {"status": "inactive"},
                "new_values": {"status": "active"},
            },
            "delete": {"reason": "User request"},
            "login": {"method": "password", "browser": "Chrome"},
            "logout": {"reason": "User initiated", "session_length": "1h 23m"},
        }

        # Get the action or default to create
        current_action = getattr(self, "action", "create")
        details = action_map.get(current_action, action_map["create"])

        # Convert to JSON string for storage
        return json.dumps(details)

    @classmethod
    def for_user(cls: Type["AuditLogFactory"], user_id: UUID, **kwargs: Any) -> "AuditLogFactory":
        """Create an audit log entry for a specific user."""
        return cls(user_id=user_id, **kwargs)

    @classmethod
    def for_action(cls: Type["AuditLogFactory"], action_type: str, **kwargs: Any) -> "AuditLogFactory":
        """Create an audit log entry for a specific action type."""
        return cls(action=action_type, **kwargs)
