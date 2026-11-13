"""
Background tasks module for FastAPI RBAC system.

This module provides utility functions for common background tasks such as:
- Sending email notifications
- Logging security audit events (in-process AuditLog writes; see log_security_event)

Email sending still supports both FastAPI BackgroundTasks and Celery.
Security events are persisted immediately by log_security_event so a
subsequent HTTPException cannot drop the write.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.models.audit_log_model import AuditLog
from app.utils.duration import humanize_minutes
from app.utils.email import send_email_with_template

logger = logging.getLogger("fastapi_rbac")

SECURITY_EVENT_RESOURCE_TYPE = "security_event"

# Import Celery tasks if available
try:
    from app.worker import send_email_task

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    send_email_task = None


async def send_password_reset_email(
    background_tasks: BackgroundTasks, user_email: str, reset_token: str, reset_url: str
) -> None:
    """
    Send a password reset email as a background task.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        user_email: The recipient's email address
        reset_token: The password reset token
        reset_url: The base URL for password reset
    """
    reset_link = f"{reset_url}?token={reset_token}"
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Password Recovery"
    template_context = {
        "project_name": project_name,
        "username": user_email,  # Assuming email is used as username here
        "email": user_email,
        "reset_password_url": reset_link,
        "token": reset_token,
        "valid_for": humanize_minutes(settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    }

    # Use Celery for email sending if
    # available and in production, otherwise use BackgroundTasks
    if CELERY_AVAILABLE and settings.MODE == "production":
        # Send via Celery task
        send_email_task.delay(
            email_to=user_email,
            subject=subject,
            template_name="password-reset.html",
            context=template_context,
        )
    else:
        # Add the email sending task to background tasks using the correct function
        background_tasks.add_task(
            send_email_with_template,  # Use the correct function
            email_to=user_email,
            subject=subject,  # Pass subject directly
            template_name="password-reset.html",  # Pass template name
            context=template_context,  # Pass context dictionary
        )


async def send_verification_email(
    background_tasks: BackgroundTasks,
    user_email: str,
    verification_token: str,
    verification_url: str,
) -> None:
    """
    Send an email verification email as a background task.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        user_email: The recipient's email address
        verification_token: The email verification token
        verification_url: The base URL for email verification
    """
    verification_link = f"{verification_url}?token={verification_token}"
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Verify Your Email Address"
    template_context = {
        "project_name": project_name,
        "username": user_email,  # Assuming email is used as username here
        "email": user_email,
        "verification_url": verification_link,
        "token": verification_token,
        "valid_for": humanize_minutes(settings.VERIFICATION_TOKEN_EXPIRE_MINUTES),
    }

    # Use Celery for email sending if available and in production, otherwise use BackgroundTasks
    if CELERY_AVAILABLE and settings.MODE == "production":
        # Send via Celery task
        send_email_task.delay(
            email_to=user_email,
            subject=subject,
            template_name="email-verification.html",  # Use the new template
            context=template_context,
        )
    else:
        # Add the email sending task to background tasks
        background_tasks.add_task(
            send_email_with_template,
            email_to=user_email,
            subject=subject,
            template_name="email-verification.html",  # Use the new template
            context=template_context,
        )


async def send_registration_notice_email(
    background_tasks: BackgroundTasks,
    user_email: str,
) -> None:
    """Tell an existing account holder that someone tried to register with their address.

    Sent instead of a verification email when the address already belongs to an
    established or disabled account (#113). Registration and resend-verification
    return the same response in every case, so this email is the only signal
    that anything happened — and it goes to the address owner, not the caller.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        user_email: The recipient's email address
    """
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - An account already exists for this email"
    template_context = {
        "project_name": project_name,
        "username": user_email,
        "email": user_email,
        "login_url": f"{settings.FRONTEND_URL}/login",
        "password_reset_url": settings.PASSWORD_RESET_URL,
    }

    if CELERY_AVAILABLE and settings.MODE == "production":
        send_email_task.delay(
            email_to=user_email,
            subject=subject,
            template_name="registration-notice.html",
            context=template_context,
        )
    else:
        background_tasks.add_task(
            send_email_with_template,
            email_to=user_email,
            subject=subject,
            template_name="registration-notice.html",
            context=template_context,
        )


async def _persist_security_event(
    db_session: AsyncSession,
    *,
    event_type: str,
    user_id: Optional[UUID],
    details: dict,
) -> None:
    """Insert one security-event AuditLog row and commit it."""
    audit_log = AuditLog(
        actor_id=user_id,
        action=event_type,
        resource_type=SECURITY_EVENT_RESOURCE_TYPE,
        resource_id=str(user_id) if user_id else "",
        details=details,
        timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db_session.add(audit_log)
    await db_session.commit()
    await db_session.refresh(audit_log)


async def log_security_event(
    background_tasks: BackgroundTasks,
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """Persist a security event as an AuditLog row.

    Awaited in-process so a later HTTPException cannot drop the write:
    FastAPI only runs BackgroundTasks on the response the endpoint returns.
    ``background_tasks`` is unused and kept so existing call sites stay
    keyword-compatible. A failed write is logged and swallowed so the
    original request status is unchanged.
    """
    _ = background_tasks
    payload = details or {}
    try:
        if db_session is None:
            from app.db.session import SessionLocal

            async with SessionLocal() as session:
                await _persist_security_event(
                    session, event_type=event_type, user_id=user_id, details=payload
                )
        else:
            await _persist_security_event(db_session, event_type=event_type, user_id=user_id, details=payload)
    except Exception:
        logger.exception("Failed to persist security event %s", event_type)
        if db_session is not None:
            try:
                await db_session.rollback()
            except Exception:
                logger.exception("Failed to roll back session after audit write failure")
