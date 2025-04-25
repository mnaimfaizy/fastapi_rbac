"""
Centralized Celery configuration for the FastAPI RBAC system.
This module contains the main Celery app instance used across the application.
"""

import os
from celery import Celery

# Use direct environment variables instead of settings
# This avoids the 'dotenvsettingssource' object has no attribute 'with_prefix' error
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")

# Initialize the main Celery app instance
celery_app = Celery(
    "fastapi_rbac",
    broker=f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
    backend=f"redis://{REDIS_HOST}:{REDIS_PORT}/0",
)

# Configure Celery directly with a dictionary
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    task_routes={
        "app.worker.send_email_task": {"queue": "emails"},
        "app.worker.cleanup_tokens_task": {"queue": "maintenance"},
        "app.worker.log_security_event_task": {"queue": "logging"},
        "app.worker.process_account_lockout_task": {"queue": "user_management"},
        "app.scheduled_tasks.*": {"queue": "periodic_tasks"},
    },
    task_default_queue="default",
    worker_prefetch_multiplier=1,
    worker_concurrency=2,
)
