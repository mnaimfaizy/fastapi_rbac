from datetime import datetime
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.audit_log_model import AuditLog
from app.models.user_model import User

from .utils import random_lower_string


@pytest.mark.asyncio
async def test_create_audit_log(db: AsyncSession) -> None:
    """Test creating an audit log entry in the database"""
    # Create a user first to use as actor
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create audit log entry
    action = "user_login"
    resource_type = "user"
    resource_id = str(user.id)
    details = {"ip_address": "192.168.1.1", "user_agent": "Test Browser"}

    audit_log = AuditLog(
        actor_id=user.id, action=action, resource_type=resource_type, resource_id=resource_id, details=details
    )

    # Add audit log to database
    db.add(audit_log)
    await db.commit()
    await db.refresh(audit_log)

    # Check that audit log was created with correct data
    assert audit_log.id is not None
    assert isinstance(audit_log.id, UUID)
    assert audit_log.actor_id == user.id
    assert audit_log.action == action
    assert audit_log.resource_type == resource_type
    assert audit_log.resource_id == resource_id
    assert audit_log.details == details
    assert isinstance(audit_log.timestamp, datetime)


@pytest.mark.asyncio
async def test_retrieve_audit_logs(db: AsyncSession) -> None:
    """Test retrieving audit log entries for a specific actor"""
    # Create a user to use as actor
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create multiple audit logs for the same actor
    logs = []
    actions = ["login", "update_profile", "password_change"]

    for i, action in enumerate(actions):
        audit_log = AuditLog(
            actor_id=user.id,
            action=action,
            resource_type="user",
            resource_id=str(user.id),
            details={"sequence": i},
        )
        logs.append(audit_log)

    db.add_all(logs)
    await db.commit()  # Retrieve all logs for this actor
    stmt = select(AuditLog).where(AuditLog.actor_id == user.id)
    result = await db.execute(stmt)
    retrieved_logs = result.scalars().all()

    # Check that all logs were retrieved correctly
    assert len(retrieved_logs) == len(actions)
    for i, log in enumerate(retrieved_logs):
        assert log.actor_id == user.id
        assert log.action in actions
        assert log.details["sequence"] in [0, 1, 2]


@pytest.mark.asyncio
async def test_filter_audit_logs_by_action(db: AsyncSession) -> None:
    """Test filtering audit logs by action type"""
    # Create a user to use as actor
    user = User(
        email=f"{random_lower_string()}@example.com",
        password=random_lower_string(),
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Create multiple audit logs with different actions
    target_action = "security_event"
    logs = [
        AuditLog(
            actor_id=user.id, action="login", resource_type="user", resource_id=str(user.id), details={}
        ),
        AuditLog(
            actor_id=user.id, action=target_action, resource_type="user", resource_id=str(user.id), details={}
        ),
        AuditLog(
            actor_id=user.id, action=target_action, resource_type="user", resource_id=str(user.id), details={}
        ),
    ]

    db.add_all(logs)
    await db.commit()

    # Filter logs by the target action
    stmt = select(AuditLog).where(AuditLog.action == target_action)
    result = await db.execute(stmt)
    filtered_logs = result.scalars().all()

    # Check that filtering works correctly
    assert len(filtered_logs) == 2
    for log in filtered_logs:
        assert log.action == target_action
