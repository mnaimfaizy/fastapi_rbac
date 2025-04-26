"""
Centralized Celery configuration for the FastAPI RBAC system.
This module contains the main Celery app instance used across the application.
"""

from celery import Celery

# Import environment-specific service settings
from app.core.service_config import service_settings

# Initialize the main Celery app instance with dynamic configuration
celery_app = Celery("fastapi_rbac")

# Apply the environment-specific configuration
celery_config = service_settings.get_celery_config()

# Add task routes to the configuration
celery_config.update(
    {
        "task_routes": {
            "app.worker.send_email_task": {"queue": "emails"},
            "app.worker.cleanup_tokens_task": {"queue": "maintenance"},
            "app.worker.log_security_event_task": {"queue": "logging"},
            "app.worker.process_account_lockout_task": {"queue": "user_management"},
            "app.scheduled_tasks.*": {"queue": "periodic_tasks"},
        },
        "task_default_queue": "default",
        "worker_prefetch_multiplier": 1,
    }
)

# Update the Celery configuration
celery_app.conf.update(celery_config)

# Conditional configuration for development mode
if service_settings.mode == "development":
    # Print debug information when running in development mode
    print(f"Celery initialized with broker: {celery_config['broker_url']}")
    print(f"Task always eager: {celery_config.get('task_always_eager', False)}")
