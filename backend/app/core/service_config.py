"""
Configuration for external services like Celery and
Redis with environment-specific settings.
This module provides different configurations based on the current environment
(development, testing, production).
"""

import os
from functools import lru_cache
from typing import Any, Dict

from app.core.config import ModeEnum, settings


class ServiceSettings:
    """
    Environment-specific service settings for Celery,
    Redis, and other external services.
    """

    def __init__(self):
        self.mode = settings.MODE

    @property
    def redis_url(self) -> str:
        """
        Get the Redis URL based on current environment
        """
        if self.mode == ModeEnum.development:
            # For local development, use localhost or
            # a containerized Redis with port mapping
            host = os.getenv("REDIS_HOST_DEV", "localhost")
            port = os.getenv("REDIS_PORT_DEV", "6379")
            return f"redis://{host}:{port}/0"
        elif self.mode == ModeEnum.testing:
            # For testing, use an in-memory mock or a test-specific Redis
            return "redis://localhost:6379/1"  # Use DB 1 for testing
        else:
            # For production, use the Docker container's Redis service
            return f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"

    @property
    def celery_broker_url(self) -> str:
        """
        Get the Celery broker URL based on current environment
        """
        return self.redis_url

    @property
    def celery_result_backend(self) -> str:
        """
        Get the Celery result backend URL based on current environment
        """
        return self.redis_url

    @property
    def use_celery(self) -> bool:
        """
        Determine whether to use Celery based on environment
        """
        # In testing, you might want to execute tasks synchronously
        if self.mode == ModeEnum.testing:
            return os.getenv("USE_CELERY_IN_TESTING", "false").lower() == "true"

        # In development, you can toggle Celery on/off for easier debugging
        if self.mode == ModeEnum.development:
            return os.getenv("USE_CELERY_IN_DEV", "true").lower() == "true"

        # Always use Celery in production
        return True

    def get_celery_config(self) -> Dict[str, Any]:
        """
        Get the Celery configuration based on current environment
        """
        common_config = {
            "broker_url": self.celery_broker_url,
            "result_backend": self.celery_result_backend,
            "task_serializer": "json",
            "accept_content": ["json"],
            "result_serializer": "json",
            "timezone": "UTC",
            "enable_utc": True,
        }

        if self.mode == ModeEnum.development:
            # Development-specific settings
            dev_config = {
                "worker_concurrency": 1,
                "task_always_eager": os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() == "true",
                "task_eager_propagates": True,
            }
            common_config.update(dev_config)

        elif self.mode == ModeEnum.testing:
            # Testing-specific settings - execute tasks synchronously by default
            test_config = {
                "task_always_eager": True,
                "task_eager_propagates": True,
                "worker_concurrency": 1,
            }
            common_config.update(test_config)

        elif self.mode == ModeEnum.production:
            # Production-specific settings
            prod_config = {
                "worker_concurrency": os.getenv("CELERY_CONCURRENCY", "8"),
                "broker_connection_retry_on_startup": True,
                "broker_pool_limit": 10,
            }
            common_config.update(prod_config)

        return common_config


@lru_cache()
def get_service_settings() -> ServiceSettings:
    """
    Get cached service settings instance.
    """
    return ServiceSettings()


service_settings = get_service_settings()
