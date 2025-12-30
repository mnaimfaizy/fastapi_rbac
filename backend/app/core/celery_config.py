"""
Celery configuration module for the FastAPI RBAC project.
This module provides configuration settings for Celery tasks and workers.
"""

from functools import lru_cache
from typing import Any, Dict

from kombu import Queue

from app.core.config import ModeEnum, settings


def get_celery_config() -> Dict[str, Any]:
    """
    Get Celery configuration dictionary with all necessary settings.

    Returns:
        Dict[str, Any]: Dictionary containing all Celery configuration settings
    """
    # Define queues using Kombu Queue objects
    task_queues = [
        Queue("default"),
        Queue("high_priority"),
        Queue("low_priority"),
        Queue("emails"),
        Queue("maintenance"),
        Queue("logging"),
        Queue("user_management"),
        Queue("periodic_tasks"),
    ]

    config = {
        # Broker and Backend
        "broker_url": settings.CELERY_BROKER_URL,
        "result_backend": settings.CELERY_RESULT_BACKEND,
        # Serialization
        "task_serializer": settings.CELERY_TASK_SERIALIZER,
        "result_serializer": settings.CELERY_RESULT_SERIALIZER,
        "accept_content": settings.CELERY_ACCEPT_CONTENT,
        # Beat Settings
        "beat_scheduler": settings.CELERY_BEAT_SCHEDULER,
        "beat_max_loop_interval": settings.CELERY_BEAT_MAX_LOOP_INTERVAL,
        # Task Settings
        "task_time_limit": settings.CELERY_TASK_TIME_LIMIT,
        "task_soft_time_limit": settings.CELERY_TASK_SOFT_TIME_LIMIT,
        "worker_prefetch_multiplier": settings.CELERY_WORKER_PREFETCH_MULTIPLIER,
        # Queue Configuration
        "task_default_queue": settings.CELERY_TASK_DEFAULT_QUEUE,
        "task_queues": task_queues,  # Use the Kombu Queue objects
        "task_routes": settings.CELERY_TASK_ROUTES,
        # Task Execution
        "task_always_eager": getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False),
        "task_eager_propagates": getattr(settings, "CELERY_TASK_EAGER_PROPAGATES", False),
        # Security and Other Settings
        "security_key": settings.SECRET_KEY,
        "timezone": settings.CELERY_TIMEZONE,
        # Additional Production Settings
        "broker_connection_retry_on_startup": True,
        "broker_pool_limit": None,  # Remove limit on broker connections
        # Task Result Settings
        "task_ignore_result": False,  # Enable storing task results
        "task_track_started": True,  # Track when tasks are started
        "task_send_sent_event": True,  # Enable sent events for monitoring
        # Worker Settings
        "worker_send_task_events": True,  # Enable worker task events
        "worker_disable_rate_limits": False,  # Enable rate limits
        # Error Handling
        "task_acks_late": True,  # Tasks are acknowledged after execution
        "task_reject_on_worker_lost": True,  # Reject tasks if worker disconnects
        # Retry Settings
        "task_default_retry_delay": 180,  # 3 minutes default retry delay
        "task_max_retries": 3,  # Maximum number of retries
    }  # Add production-specific settings
    if settings.MODE == ModeEnum.production:
        # SSL options for Redis with proper certificate validation
        import os
        import ssl

        # Path to certificate files (should match Redis connection factory)
        cert_path = os.getenv("REDIS_CERT_PATH", "/app/certs")
        if not os.path.exists(cert_path):
            cert_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "certs")

        ca_cert_path = os.path.join(cert_path, "ca.crt")

        # Configure SSL with certificate validation for production
        # This ensures secure connections to Redis broker and backend
        ssl_opts = {
            "ssl_cert_reqs": ssl.CERT_REQUIRED,  # Require valid certificate
            "ssl_ca_certs": ca_cert_path if os.path.exists(ca_cert_path) else None,
            "ssl_check_hostname": True,  # Verify hostname matches certificate
        }

        # Remove None values from ssl_opts
        ssl_opts = {k: v for k, v in ssl_opts.items() if v is not None}

        # If CA cert is missing in production, log a warning
        if not os.path.exists(ca_cert_path):
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"CA certificate not found at {ca_cert_path}. "
                "SSL connections to Redis may fail. "
                "Generate certificates using backend/certs/generate-certs.sh"
            )

        config.update(
            {
                # For broker_use_ssl, Celery expects a dictionary or None.
                # If you are using Redis as a broker and want SSL:
                "broker_use_ssl": ssl_opts if ssl_opts else None,
                # For redis_backend_use_ssl, Celery also expects a dictionary or None.
                "redis_backend_use_ssl": ssl_opts if ssl_opts else None,
                "task_default_rate_limit": "10000/m",  # Limit tasks to 10000 per minute
                "worker_max_tasks_per_child": 1000,  # Restart worker after 1000 tasks
                # Enhanced connection settings for production
                "broker_connection_retry": True,
                "broker_connection_retry_on_startup": True,
                "broker_connection_max_retries": 10,
                "broker_pool_limit": 50,  # Limit broker connection pool size
                "broker_heartbeat": 30,  # Send heartbeat every 30 seconds
                "broker_heartbeat_checkrate": 2,  # Check heartbeat twice as often
            }
        )

    return config


@lru_cache()
def get_cached_celery_config() -> Dict[str, Any]:
    """
    Get cached Celery configuration.

    Uses lru_cache to cache the configuration and avoid repeated lookups.

    Returns:
        Dict[str, Any]: Cached dictionary of Celery configuration settings
    """
    return get_celery_config()
