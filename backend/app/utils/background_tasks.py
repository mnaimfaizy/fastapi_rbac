"""
Background tasks module for FastAPI RBAC system.

This module provides utility functions for common background tasks such as:
- Sending email notifications
- Cleaning up expired tokens
- Logging security audit events
- Managing user account states
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import BackgroundTasks
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession

from app import crud

# Import settings
from app.core.config import settings
from app.models.user_model import User
from app.schemas.common_schema import TokenType
from app.utils.email import send_email_with_template


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

    # Add the email sending task to background tasks using the correct function
    background_tasks.add_task(
        send_email_with_template,  # Use the correct function
        email_to=user_email,
        subject=subject,  # Pass subject directly
        template_name="password-reset.html",  # Pass template name
        context=template_context,  # Pass context dictionary
    )


async def cleanup_expired_tokens(
    background_tasks: BackgroundTasks,
    redis_client: Redis,
    user_id: UUID,
    token_type: TokenType,
) -> None:
    """
    Clean up expired tokens from Redis.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        redis_client: The Redis client instance
        user_id: The user ID whose tokens to clean
        token_type: The type of token to clean up
    """
    # Add token cleanup task to background tasks
    background_tasks.add_task(
        _cleanup_tokens_task,
        redis_client=redis_client,
        user_id=user_id,
        token_type=token_type,
    )


async def _cleanup_tokens_task(
    redis_client: Redis, user_id: UUID, token_type: TokenType
) -> None:
    """
    Internal function to clean up expired tokens.
    Not to be called directly, but through cleanup_expired_tokens.
    """
    token_key = f"user:{user_id}:{token_type}"
    # Check if key exists and delete it
    if await redis_client.exists(token_key):
        await redis_client.delete(token_key)


async def log_security_event(
    background_tasks: BackgroundTasks,
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    Log a security event for audit purposes.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        event_type: Type of security event (login, logout, password_change, etc.)
        user_id: The ID of the user related to this event
        details: Additional details about the event
        db_session: Database session for database operations
    """
    # This would be replaced with your actual security logging implementation
    # Add the logging task to background tasks
    background_tasks.add_task(
        _log_security_event_task,
        event_type=event_type,
        user_id=user_id,
        details=details,
        db_session=db_session,
    )


async def _log_security_event_task(
    event_type: str,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    Internal function to log security events.
    Not to be called directly, but through log_security_event.
    """
    # Implement your security event logging here
    # This could be writing to a database table, sending to a logging service, etc.
    print(f"Security event: {event_type} for user {user_id} with details: {details}")
    # In a real implementation, you'd save this to your database or send to a logging system


async def process_account_lockout(
    background_tasks: BackgroundTasks,
    user: User,
    lock_duration_hours: int = 24,
    db_session: Optional[AsyncSession] = None,
) -> None:
    """
    Process account lockout as a background task.

    Args:
        background_tasks: The FastAPI BackgroundTasks instance
        user: The user whose account is being locked
        lock_duration_hours: Duration of the lockout in hours
        db_session: Database session for database operations
    """
    # Add the account lockout task to background tasks
    background_tasks.add_task(
        _process_account_lockout_task,
        user=user,
        lock_duration_hours=lock_duration_hours,
        db_session=db_session,
    )


async def _process_account_lockout_task(
    user: User, lock_duration_hours: int = 24, db_session: Optional[AsyncSession] = None
) -> None:
    """
    Internal function to process account lockout.
    Not to be called directly, but through process_account_lockout.
    """
    # Lock the account
    if db_session:
        user.is_locked = True
        user.locked_until = datetime.utcnow() + timedelta(hours=lock_duration_hours)
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)

        # Here you might also want to:
        # 1. Send a notification to the user about the account lockout
        # 2. Send a notification to admins about suspicious activity
        # 3. Log the event in an audit log
