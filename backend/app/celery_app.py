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

# Both modules attach themselves to this app instance, and everything Celery runs
# starts from `celery -A app.celery_app` — the worker and beat containers import
# nothing else.
#
# worker: registers the tasks even when conf.imports has not been applied yet
# (e.g. inspect / early worker boot).
#
# celery_beat_schedule: fills conf.beat_schedule. app.main used to be its only
# importer, and the beat process never loads app.main, so beat booted with an
# empty schedule and no periodic task fired at all (#136).
from app import celery_beat_schedule as _beat_schedule  # noqa: E402, F401
from app import worker as _worker_tasks  # noqa: E402, F401

# Conditional configuration for development mode
if settings.MODE == ModeEnum.development:
    # Print debug information when running in development mode
    print(f"Celery initialized with broker: {celery_config['broker_url']}")
    print(f"Task always eager: {celery_config.get('task_always_eager', False)}")
    print(f"Available task queues: {', '.join(q.name for q in celery_config['task_queues'])}")
