"""
Scheduled tasks for the FastAPI RBAC system.

This module contains functions that run on a schedule via Celery Beat.
These tasks handle maintenance operations that need to happen periodically
such as cleaning up old data, checking account statuses, etc.
"""

import asyncio
import logging
from datetime import datetime

from app import crud
# Import the Celery app instance from centralized config
from app.celery_app import celery_app
from app.core.config import settings
from app.db.session import get_async_session, get_redis_client


@celery_app.task(name="app.scheduled_tasks.cleanup_all_expired_tokens")
def cleanup_all_expired_tokens() -> dict:
    """
    Clean up all expired tokens from Redis.

    Returns:
        dict: Report of cleanup operations with counts
    """
    logging.info("Starting cleanup of all expired tokens")

    async def async_cleanup():
        redis_client = await get_redis_client()
        # Find all token keys
        all_token_keys = await redis_client.keys("user:*:token:*")

        # Check each token for expiration
        expired_count = 0
        for key in all_token_keys:
            # Get TTL
            ttl = await redis_client.ttl(key)
            # If TTL <= 0, token is expired
            if ttl <= 0:
                await redis_client.delete(key)
                expired_count += 1

        await redis_client.close()
        return {
            "expired_tokens_removed": expired_count,
            "total_tokens_checked": len(all_token_keys),
        }

    return asyncio.run(async_cleanup())


@celery_app.task(name="app.scheduled_tasks.cleanup_old_security_logs")
def cleanup_old_security_logs(days_to_keep: int = 90) -> dict:
    """
    Remove security log entries older than the specified number of days.

    Args:
        days_to_keep: Number of days to keep logs for

    Returns:
        dict: Report of operations performed
    """
    logging.info(f"Cleaning up security logs older than {days_to_keep} days")

    async def async_cleanup():
        deleted_count = 0

        async for db_session in get_async_session():
            # This is a placeholder - implement based on your actual security audit log model
            # Example: Use SQLAlchemy to delete old records
            # cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            # result = await db_session.execute(
            #     delete(SecurityAuditLog).where(SecurityAuditLog.created_at < cutoff_date)
            # )
            # deleted_count = result.rowcount
            # await db_session.commit()
            break

        return {"deleted_log_entries": deleted_count}

    return asyncio.run(async_cleanup())


@celery_app.task(name="app.scheduled_tasks.process_account_unlocks")
def process_account_unlocks() -> dict:
    """
    Check for locked accounts whose lock period has expired and unlock them.

    Returns:
        dict: Report of accounts unlocked
    """
    logging.info("Processing account unlocks")

    async def async_unlock_accounts():
        unlocked_accounts = 0

        async for db_session in get_async_session():
            # Get all locked accounts where locked_until is in the past
            locked_users = await crud.user.get_multi(
                db_session=db_session,
                filters={"is_locked": True},
            )

            now = datetime.utcnow()
            for user in locked_users:
                # Check if lock period has expired
                if user.locked_until and user.locked_until < now:
                    # Unlock account
                    user.is_locked = False
                    user.locked_until = None
                    user.failed_login_attempts = 0
                    await crud.user.update(db_obj=user, db_session=db_session)
                    unlocked_accounts += 1

                    # Log the event
                    # You could add a call to log_security_event here

            break  # Exit the session loop after first iteration

        return {"accounts_unlocked": unlocked_accounts}

    return asyncio.run(async_unlock_accounts())


@celery_app.task(name="app.scheduled_tasks.system_health_check")
def system_health_check() -> dict:
    """
    Perform a system health check to verify core components are working.

    Returns:
        dict: Health status report
    """
    logging.info("Performing system health check")
    health_status = {"status": "ok", "components": {}}

    async def async_health_check():
        # Check database connection
        db_status = "ok"
        try:
            async for db_session in get_async_session():
                # Try a simple query
                await db_session.execute("SELECT 1")
                break
        except Exception as e:
            db_status = f"error: {str(e)}"
            health_status["status"] = "error"

        health_status["components"]["database"] = db_status

        # Check Redis connection
        redis_status = "ok"
        try:
            redis_client = await get_redis_client()
            await redis_client.ping()
            await redis_client.close()
        except Exception as e:
            redis_status = f"error: {str(e)}"
            health_status["status"] = "error"

        health_status["components"]["redis"] = redis_status

        # Check email configuration
        email_status = "ok" if settings.EMAILS_ENABLED else "disabled"
        health_status["components"]["email"] = email_status

        return health_status

    return asyncio.run(async_health_check())
