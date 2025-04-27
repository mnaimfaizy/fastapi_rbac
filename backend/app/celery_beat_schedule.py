"""
Scheduled tasks configuration for Celery Beat.
This module defines recurring tasks that run automatically based on a schedule.
"""

from datetime import timedelta

from celery.schedules import crontab

# Import the celery app from centralized configuration
from app.celery_app import celery_app

# Register scheduled tasks with Celery Beat
# Make sure each task has been imported and registered with Celery
celery_app.conf.beat_schedule = {
    # Run every day at midnight to clean up expired tokens
    "cleanup-all-expired-tokens": {
        "task": "app.scheduled_tasks.cleanup_all_expired_tokens",
        "schedule": crontab(hour=0, minute=0),
        "options": {"queue": "periodic_tasks"},
    },
    # Run every week to clean up old security logs (if applicable)
    "cleanup-old-security-logs": {
        "task": "app.scheduled_tasks.cleanup_old_security_logs",
        "schedule": crontab(day_of_week="sunday", hour=1, minute=0),
        "options": {"queue": "periodic_tasks"},
    },
    # Run every hour to check and unlock accounts with expired lock periods
    "process-account-unlocks": {
        "task": "app.scheduled_tasks.process_account_unlocks",
        "schedule": timedelta(hours=1),
        "options": {"queue": "periodic_tasks"},
    },
    # Run health check every 5 minutes to ensure system is operating properly
    "system-health-check": {
        "task": "app.scheduled_tasks.system_health_check",
        "schedule": timedelta(minutes=5),
        "options": {"queue": "periodic_tasks"},
    },
}

# Import the scheduled tasks to ensure they're registered with Celery
# This is needed to avoid the "Unable to load celery application" error
