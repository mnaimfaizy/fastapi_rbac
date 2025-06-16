"""
Background tasks module for FastAPI RBAC system.

This module provides utility functions for common background tasks such as:
- Sending email notifications
- Cleaning up expired tokens
- Logging security audit events
- Managing user account states

This module supports both FastAPI BackgroundTasks for simple operations
and Celery for more complex, long-running, or scheduled tasks.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud
from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.email import send_email_with_template

# Import Celery tasks if available
try:
    from app.worker import (
        cleanup_tokens_task,
        log_security_event_task,
        process_account_lockout_task,
        send_email_task,
    )

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    send_email_task = None
    cleanup_tokens_task = None
    log_security_event_task = None
    process_account_lockout_task = None


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
        "valid_hours": settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES // 60,
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
        "valid_hours": settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES // 60,
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


async def cleanup_expired_tokens(
    background_tasks: BackgroundTasks,
    redis_client: Redis,
    user_id: UUID,
    token_type: TokenType,
) -> None:
    """
    Add token cleanup task to background tasks.

    Args:
        background_tasks: BackgroundTasks instance
        redis_client: Redis client instance
        user_id: User ID to clean tokens for
        token_type: Type of token to clean
    """
    # Use Celery for token cleanup if
    # available and in production, otherwise use BackgroundTasks
    if CELERY_AVAILABLE and settings.MODE == "production":
        # Send via Celery task
        cleanup_tokens_task.delay(str(user_id), token_type.value)
    else:
        # Use FastAPI background tasks
        background_tasks.add_task(_cleanup_tokens_task, redis_client, user_id, token_type)


async def _cleanup_tokens_task(redis_client: Redis, user_id: UUID, token_type: TokenType) -> None:
    """
    Clean up expired tokens for a user.
    This is the actual task that gets executed in the background.
    """
    # Implementation details...
    # Delete user tokens based on token type
    key_pattern = f"user:{user_id}:{token_type.value}:*"
    keys = await redis_client.keys(key_pattern)

    if keys:
        await redis_client.delete(*keys)


async def log_security_event(
    background_tasks: BackgroundTasks,
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    Log a security event to the audit log in the background.

    Args:
        background_tasks: BackgroundTasks instance
        event_type: Type of security event
        user_id: Optional ID of the user associated with the event
        details: Optional additional details about the event
        db_session: Optional database session to use
    """
    # Use Celery for security logging if available
    # and in production, otherwise use BackgroundTasks
    if CELERY_AVAILABLE and settings.MODE == "production":
        # Send via Celery task
        log_security_event_task.delay(
            event_type,
            str(user_id) if user_id else None,
            details,
        )
    else:
        # Use FastAPI background tasks
        background_tasks.add_task(
            _log_security_event_task,
            event_type,
            user_id,
            details,
            db_session,
        )


async def _log_security_event_task(
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    The actual task that logs a security event to the audit log.
    """
    # Implementation for logging security events
    # This would typically create an entry in a security_audit table


async def process_account_lockout(
    background_tasks: BackgroundTasks,
    user: User,
    lock_duration_hours: int = 24,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    Process account lockout in the background.

    Args:
        background_tasks: BackgroundTasks instance
        user: User object to lock out
        lock_duration_hours: Duration of lockout in hours
        db_session: Optional database session to use
    """
    # Use Celery for account lockout if available
    # and in production, otherwise use BackgroundTasks
    if CELERY_AVAILABLE and settings.MODE == "production":
        # Send via Celery task
        process_account_lockout_task.delay(str(user.id), lock_duration_hours)
    else:
        # Use FastAPI background tasks
        background_tasks.add_task(
            _process_account_lockout_task,
            user,
            lock_duration_hours,
            db_session,
        )


async def _process_account_lockout_task(
    user: User, lock_duration_hours: int = 24, db_session: Optional[AsyncSession] = None
) -> None:
    """
    The actual task that processes an account lockout.
    """  # Set account as locked
    user.is_locked = True
    user.locked_until = (datetime.now(timezone.utc) + timedelta(hours=lock_duration_hours)).replace(
        tzinfo=None
    )

    # Save to database
    if db_session is None:
        from app.db.session import get_async_session

        async for session in get_async_session():
            db_session = session
            break

    await crud.user.update(db_obj=user, db_session=db_session)


async def cleanup_unverified_account(
    background_tasks: BackgroundTasks,
    user_id: UUID,
    redis_client: Redis,
    delay_hours: int = 24,
) -> None:
    """
    Cleanup task for unverified accounts.
    Deletes the account and associated data if not verified within the specified time.

    Args:
        background_tasks: BackgroundTasks instance
        user_id: User ID of the account to clean up
        redis_client: Redis client instance
        delay_hours: Number of hours to wait before cleanup
    """
    try:
        await asyncio.sleep(delay_hours * 3600)  # Convert hours to seconds

        # Check if user still exists and is still unverified
        user = await crud.user.get(id=user_id)
        if user and not user.verified:
            # Delete verification token from Redis
            await redis_client.delete(f"verification_token:{user_id}")

            # Delete user
            await crud.user.delete(id=user_id)

            # Log cleanup
            background_tasks.add_task(
                log_security_event,
                background_tasks=background_tasks,
                event_type="unverified_account_cleaned_up",
                details={"user_id": str(user_id)},
            )
    except Exception as e:
        # Log cleanup failure
        background_tasks.add_task(
            log_security_event,
            background_tasks=background_tasks,
            event_type="unverified_account_cleanup_failed",
            details={"error": str(e), "user_id": str(user_id)},
        )
