from datetime import datetime
from typing import Any, Dict
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.audit_log_model import AuditLog


async def create_audit_log(
    *,
    db_session: AsyncSession,
    actor_id: UUID,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Dict[str, Any],
) -> AuditLog:
    """Create an audit log entry for security-related actions"""
    audit_log = AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        timestamp=datetime.utcnow(),
    )

    db_session.add(audit_log)
    await db_session.commit()
    await db_session.refresh(audit_log)

    return audit_log
