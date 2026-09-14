"""
Scheduled tasks configuration for Celery Beat.
This module defines recurring tasks that run automatically based on a schedule.

Every task named here must be registered on ``celery_app`` — beat happily
dispatches a name no worker can resolve. ``app.celery_app`` imports this module
so ``celery -A app.celery_app beat`` boots with the schedule filled in (#136),
and ``test_beat_schedule_only_names_registered_tasks`` guards the invariant.
"""

from datetime import timedelta

# Import the celery app from centralized configuration
from app.celery_app import celery_app

# Register scheduled tasks with Celery Beat
celery_app.conf.beat_schedule = {
    # Run every hour to delete pending users whose verification window expired.
    # Hourly rather than once a day so the window is honoured to within an hour,
    # and so a restart costs at most one tick (#136).
    "cleanup-unverified-users": {
        "task": "app.worker.cleanup_unverified_users_task",
        "schedule": timedelta(hours=1),
        "options": {"queue": "periodic_tasks"},
    },
}
