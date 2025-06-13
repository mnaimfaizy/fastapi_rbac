"""
Service configuration for environment-specific settings.
Manages Redis, Celery, and other service configurations.
"""

import os
from typing import Any, Dict

from app.core.config import ModeEnum, settings


class ServiceSettings:
    """
    Environment-specific service settings for Celery,
    Redis, and other external services.
    """

    def __init__(self) -> None:
        self.mode = settings.MODE

    @property
    def redis_url(self) -> str:
        """
        Get the Redis URL based on current environment
        """
        if self.mode == ModeEnum.development:
            # For development, use the configured Redis host (Docker container or localhost)
            host = os.getenv("REDIS_HOST", settings.REDIS_HOST)
            port = os.getenv("REDIS_PORT", settings.REDIS_PORT)
            return f"redis://{host}:{port}/0"
        elif self.mode == ModeEnum.testing:
            # For testing, use the configured Redis host (Docker container or localhost)
            host = os.getenv("REDIS_HOST", settings.REDIS_HOST)
            port = os.getenv("REDIS_PORT", settings.REDIS_PORT)
            db = os.getenv("REDIS_DB", "0")  # Use configured DB or default to 0
            return f"redis://{host}:{port}/{db}"
        else:
            # For production, use the Docker container's Redis service with TLS
            return f"rediss://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0?ssl_cert_reqs=none"

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
        return self.mode in [ModeEnum.development, ModeEnum.production]

    @property
    def celery_task_routes(self) -> Dict[str, Any]:
        """
        Get task routing configuration for Celery
        """
        return {
            "app.worker.send_email": {"queue": "email"},
            "app.worker.send_reset_password_email": {"queue": "email"},
            "app.worker.send_verification_email": {"queue": "email"},
            "app.worker.cleanup_unverified_accounts": {"queue": "cleanup"},
            "app.worker.cleanup_expired_tokens": {"queue": "cleanup"},
        }

    @property
    def celery_beat_schedule(self) -> Dict[str, Any]:
        """
        Get scheduled task configuration for Celery Beat
        """
        return {
            "cleanup-unverified-accounts": {
                "task": "app.worker.cleanup_unverified_accounts",
                "schedule": 3600.0,  # Run every hour
            },
            "cleanup-expired-tokens": {
                "task": "app.worker.cleanup_expired_tokens",
                "schedule": 1800.0,  # Run every 30 minutes
            },
        }

    @property
    def email_settings(self) -> Dict[str, Any]:
        """
        Get email configuration based on environment
        """
        if self.mode == ModeEnum.development:
            return {
                "SMTP_HOST": os.getenv("SMTP_HOST", "mailhog"),
                "SMTP_PORT": int(os.getenv("SMTP_PORT", "1025")),
                "SMTP_TLS": os.getenv("SMTP_TLS", "false").lower() == "true",
                "SMTP_USER": os.getenv("SMTP_USER", ""),
                "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
            }
        elif self.mode == ModeEnum.testing:
            return {
                "SMTP_HOST": os.getenv("SMTP_HOST", "mailhog_test"),
                "SMTP_PORT": int(os.getenv("SMTP_PORT", "1025")),
                "SMTP_TLS": os.getenv("SMTP_TLS", "false").lower() == "true",
                "SMTP_USER": os.getenv("SMTP_USER", ""),
                "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
            }
        else:
            # Production settings
            return {
                "SMTP_HOST": settings.SMTP_HOST,
                "SMTP_PORT": settings.SMTP_PORT,
                "SMTP_TLS": settings.SMTP_TLS,
                "SMTP_USER": settings.SMTP_USER,
                "SMTP_PASSWORD": settings.SMTP_PASSWORD,
            }

    @property
    def database_url(self) -> str:
        """
        Get database URL based on environment
        """
        if self.mode == ModeEnum.testing:
            # Use environment variables for testing
            host = os.getenv("DATABASE_HOST", settings.DATABASE_HOST)
            port = os.getenv("DATABASE_PORT", str(settings.DATABASE_PORT))
            user = os.getenv("DATABASE_USER", settings.DATABASE_USER)
            password = os.getenv("DATABASE_PASSWORD", settings.DATABASE_PASSWORD)
            db_name = os.getenv("DATABASE_NAME", settings.DATABASE_NAME)
            return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"
        else:
            # Use settings for development and production
            return str(settings.DATABASE_URL)


# Global instance
service_settings = ServiceSettings()
