"""
Centralized Celery configuration for the FastAPI RBAC system.
This module contains the main Celery app instance used across the application.
"""

from celery import Celery

from app.core.celery_config import get_cached_celery_config
from app.core.config import ModeEnum, settings

# Initialize the main Celery app instance
celery_app = Celery("fastapi_rbac")

# Get the cached Celery configuration
celery_config = get_cached_celery_config()

# Update the Celery configuration
celery_app.conf.update(celery_config)

# Conditional configuration for development mode
if settings.MODE == ModeEnum.development:
    # Print debug information when running in development mode
    print(f"Celery initialized with broker: {celery_config['broker_url']}")
    print(f"Task always eager: {celery_config.get('task_always_eager', False)}")
    print(
        f"Available task queues: {', '.join(q.name for q in celery_config['task_queues'])}"
    )
