"""
Celery worker configuration for handling background tasks.
"""

# Import the Celery app from the centralized configuration
from typing import Any

from app.celery_app import celery_app


# Define tasks that convert the existing background functions to Celery tasks
@celery_app.task
def send_email_task(
    email_to: str,
    subject: str,
    template_name: str,
    context: dict,
) -> None:
    """Celery task for sending emails"""
    from app.utils.email.email import send_email_with_template

    send_email_with_template(
        email_to=email_to,
        subject=subject,
        template_name=template_name,
        context=context,
    )


@celery_app.task
def cleanup_tokens_task(user_id: str, token_type: str) -> None:
    """Celery task for cleaning up expired tokens"""
    import asyncio
    from uuid import UUID

    from app.schemas.common_schema import TokenType

    async def async_cleanup_tokens(user_id_str: str, token_type_str: str) -> None:
        from app.db.session import get_redis_client

        async for redis_client in get_redis_client():
            user_id = UUID(user_id_str)
            token_type_enum = TokenType(token_type_str)

            # Delete user tokens based on token type
            key_pattern = f"user:{user_id}:{token_type_enum.value}:*"
            keys = await redis_client.keys(key_pattern)

            if keys:
                await redis_client.delete(*keys)
            # Redis client is closed automatically after exiting the async for loop
            break  # Exit after first iteration

    asyncio.run(async_cleanup_tokens(user_id, token_type))


@celery_app.task
def log_security_event_task(
    event_type: str, user_id: str | None = None, details: dict[Any, Any] | None = None
) -> None:
    """Celery task for logging security events"""
    import asyncio
    from uuid import UUID

    async def async_log_security_event(
        event_type: str, user_id_str: str | None, details: dict[Any, Any] | None
    ) -> None:
        from app.db.session import get_async_session

        async for db_session in get_async_session():
            UUID(user_id_str) if user_id_str else None

            # TODO: Implement logging to security audit log table
            # This is a placeholder for actual implementation

            await db_session.commit()
            break

    asyncio.run(async_log_security_event(event_type, user_id, details or {}))


@celery_app.task
def process_account_lockout_task(user_id: str, lock_duration_hours: int = 24) -> None:
    """Celery task for processing account lockouts"""
    import asyncio
    from datetime import datetime, timedelta, timezone
    from uuid import UUID

    async def async_process_lockout(user_id_str: str, lock_duration_hours: int) -> None:
        from sqlmodel.ext.asyncio.session import AsyncSession  # Ensure correct import

        from app import crud
        from app.db.session import get_async_session

        user_id_obj = UUID(user_id_str)

        async for db_session in get_async_session():
            assert isinstance(db_session, AsyncSession)
            user = await crud.user.get(id=user_id_obj, db_session=db_session)
            if user:  # Create a dict with the updates to use as obj_new
                updates = {
                    "is_locked": True,
                    "locked_until": (
                        datetime.now(timezone.utc) + timedelta(hours=lock_duration_hours)
                    ).replace(tzinfo=None),
                }
                await crud.user.update(obj_current=user, obj_new=updates, db_session=db_session)
            break

    asyncio.run(async_process_lockout(user_id, lock_duration_hours))
