import logging
import os
import ssl
import sys
from pathlib import Path
from typing import Any

import tenacity
from redis.exceptions import AuthenticationError  # Import AuthenticationError directly
from sqlalchemy import create_engine, text

# Add the 'backend' directory (parent of 'app') to sys.path
# Path(__file__) is d:\Projects\fastapi_rbac\backend\app\backend_pre_start.py
# Path(__file__).resolve().parent is d:\Projects\fastapi_rbac\backend\app
# Path(__file__).resolve().parent.parent is d:\Projects\fastapi_rbac\backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import ModeEnum, settings  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1


@tenacity.retry(
    stop=tenacity.stop_after_attempt(max_tries),
    wait=tenacity.wait_fixed(wait_seconds),
    before=tenacity.before_log(logger, logging.INFO),
    after=tenacity.after_log(logger, logging.WARN),
)
def wait_for_database() -> None:
    """Check if the database is ready for connections."""
    try:
        # Try explicit SQLALCHEMY_DATABASE_URI first (e.g., from Docker Compose)
        database_uri = os.getenv("SQLALCHEMY_DATABASE_URI")

        # If not available, try different drivers
        if not database_uri:
            db_user = settings.DATABASE_USER
            db_pass = settings.DATABASE_PASSWORD
            db_host = settings.DATABASE_HOST
            db_port = settings.DATABASE_PORT
            db_name = settings.DATABASE_NAME
            # Try psycopg2 driver
            try:
                pass  # Assuming psycopg2 is installed or handled elsewhere
                logger.info("Using psycopg2 driver for database connection")
                if hasattr(settings, "SYNC_CELERY_DATABASE_URI"):
                    database_uri = str(settings.SYNC_CELERY_DATABASE_URI)
                else:
                    # Build connection string manually
                    database_uri = (
                        f"postgresql+psycopg2://{db_user}:{db_pass}" f"@{db_host}:{db_port}/{db_name}"
                    )
            except ImportError:
                # Try asyncpg driver if psycopg2 fails
                try:
                    pass  # Assuming asyncpg is installed or handled elsewhere
                    logger.info("Using asyncpg driver for database connection")
                    if hasattr(settings, "ASYNC_DATABASE_URI"):
                        database_uri = str(settings.ASYNC_DATABASE_URI)
                    else:
                        # Fall back to direct PostgreSQL connection
                        database_uri = f"postgresql://{db_user}:{db_pass}" f"@{db_host}:{db_port}/{db_name}"
                except ImportError:
                    logger.warning("Neither psycopg2 nor asyncpg found, using default URI")
                    # Generic connection string as last resort
                    database_uri = f"postgresql://{db_user}:{db_pass}" f"@{db_host}:{db_port}/{db_name}"

        # Mask password for logging
        password_to_mask = settings.DATABASE_PASSWORD if settings.DATABASE_PASSWORD else ""
        masked_uri = database_uri.replace(password_to_mask, "****") if database_uri else "None"
        logger.info(f"Connecting to database using URI: {masked_uri}")

        # Create engine and test connection
        engine = create_engine(database_uri)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database is ready")
    except Exception as e:
        logger.error(f"Database is not ready: {e}")
        raise


@tenacity.retry(
    stop=tenacity.stop_after_attempt(max_tries),
    wait=tenacity.wait_fixed(wait_seconds),
    before=tenacity.before_log(logger, logging.INFO),
    after=tenacity.after_log(logger, logging.WARN),
)
def wait_for_redis() -> None:
    """Check if Redis is ready for connections."""
    try:
        import redis

        default_redis_port = 6379
        redis_host_from_settings = settings.REDIS_HOST
        redis_port_from_settings = settings.REDIS_PORT

        # Get Redis connection details based on environment mode
        if settings.MODE == ModeEnum.development:
            # In Docker development, use the container name from settings
            redis_host = os.getenv("REDIS_HOST", str(redis_host_from_settings))
            redis_port_str = os.getenv("REDIS_PORT", str(redis_port_from_settings))
            redis_ssl = False
            logger.info("Development mode: Using configured Redis without SSL.")
        elif settings.MODE == ModeEnum.testing:
            # Use configured Redis for testing (likely Docker)
            redis_host = os.getenv("REDIS_HOST", str(redis_host_from_settings))
            redis_port_str = os.getenv("REDIS_PORT", str(redis_port_from_settings))
            redis_ssl = os.getenv("REDIS_SSL", "").lower() == "true"
            logger.info("Testing mode: Using configured Redis (Docker/settings).")
        else:  # Production or other modes
            # Default to environment variables or settings
            redis_host = os.getenv("REDIS_HOST", str(redis_host_from_settings))
            redis_port_str = os.getenv("REDIS_PORT", str(redis_port_from_settings))
            # In production, get SSL setting from environment or default to True
            redis_ssl = os.getenv("REDIS_SSL", "true").lower() == "true"
            logger.info(
                "%s mode: Using configured Redis with SSL=%s.",
                settings.MODE.value,
                redis_ssl,
            )

        # Convert port to int, with a default if None or invalid
        try:
            redis_port = int(redis_port_str) if redis_port_str is not None else default_redis_port
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid REDIS_PORT value '{redis_port_str}'. Defaulting to {default_redis_port}."
            )
            redis_port = default_redis_port

        if redis_host is None:
            logger.warning("REDIS_HOST is not set. Defaulting to 'localhost'.")  # type: ignore
            redis_host = "localhost"

        redis_password = os.getenv("REDIS_PASSWORD", settings.REDIS_PASSWORD)

        # Get SSL certificate paths when SSL is enabled
        ssl_ca_certs: str | None = None
        ssl_certfile: str | None = None
        ssl_keyfile: str | None = None

        if redis_ssl:
            # Path to the certificate files (adjust for container paths)
            base_cert_path = os.getenv("REDIS_CERT_PATH", "/app/certs")

            # For local development or when running outside container
            if not os.path.exists(base_cert_path):
                base_cert_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "certs")
                logger.info(
                    "Certificate path not found at %s, using local certs directory",
                    base_cert_path,
                )

            ssl_ca_certs = os.path.join(base_cert_path, "ca.crt")
            ssl_certfile = os.path.join(base_cert_path, "redis.crt")
            ssl_keyfile = os.path.join(base_cert_path, "redis.key")

            # Verify certificates exist
            if not os.path.exists(ssl_ca_certs):
                if settings.MODE == ModeEnum.production:
                    raise RuntimeError(
                        (
                            f"Redis TLS is enabled but CA certificate was not found at {ssl_ca_certs}. "
                            "Generate certs via backend/certs/generate-certs.(sh|ps1) and ensure "
                            "they are mounted at /app/certs."
                        )
                    )
                logger.warning(
                    f"CA certificate not found at {ssl_ca_certs}. "
                    "Redis TLS is enabled; connection will likely fail."
                )
            if not os.path.exists(ssl_certfile):
                logger.warning(f"Certificate not found at {ssl_certfile}, SSL might not work properly")
            if not os.path.exists(ssl_keyfile):
                logger.warning(f"Key not found at {ssl_keyfile}, SSL might not work properly")

            logger.info(f"Using SSL certificates at {base_cert_path}")

        logger.info(f"Attempting to connect to Redis at {redis_host}:{redis_port} with SSL={redis_ssl}")

        # Create connection configuration based on whether SSL is enabled
        if redis_ssl:
            logger.info("Connecting to Redis with SSL and password.")
            ssl_kwargs: dict[str, Any] = {
                "ssl": True,
                "ssl_cert_reqs": ssl.CERT_REQUIRED,
            }

            # Only add certificate paths if files exist and not None
            if ssl_ca_certs and os.path.exists(ssl_ca_certs):
                ssl_kwargs["ssl_ca_certs"] = ssl_ca_certs
            elif settings.MODE == ModeEnum.production:
                # Production must never silently downgrade TLS verification.
                raise RuntimeError(
                    "Redis TLS is enabled in production but CA certificate is missing; "
                    "refusing to connect with insecure settings."
                )
            # Do NOT add ssl_certfile or ssl_keyfile unless mutual TLS is required
            # if ssl_certfile and os.path.exists(ssl_certfile):
            #     ssl_kwargs["ssl_certfile"] = ssl_certfile
            # if ssl_keyfile and os.path.exists(ssl_keyfile):
            #     ssl_kwargs["ssl_keyfile"] = ssl_keyfile

            # Hostname verification
            # The generated Redis cert (backend/certs/redis_cert.cnf) includes SANs for:
            # - fastapi_rbac_redis_prod
            # - fastapi_rbac_redis
            # - localhost
            # so we can (and should) verify hostnames in production.
            ssl_check_hostname_env = os.getenv("REDIS_SSL_CHECK_HOSTNAME")
            if ssl_check_hostname_env is not None:
                ssl_kwargs["ssl_check_hostname"] = ssl_check_hostname_env.lower() == "true"
            else:
                ssl_kwargs["ssl_check_hostname"] = settings.MODE == ModeEnum.production

            # Log the SSL settings being used
            logger.info(f"Redis SSL configuration: {ssl_kwargs}")

            r = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password if redis_password else None,
                db=0,
                **ssl_kwargs,
            )  # type: ignore[arg-type]
        elif redis_password:
            logger.info("Connecting to Redis with a password (no SSL).")
            r = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password if redis_password else None,
                db=0,
            )
        else:
            logger.info("Connecting to Redis without a password and without SSL.")
            r = redis.Redis(host=redis_host, port=redis_port, db=0)

        r.ping()
        logger.info("Redis is ready")
    except AuthenticationError as e:  # Use the directly imported AuthenticationError
        logger.error(f"Redis authentication failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Redis is not ready: {e}")
        raise


def main() -> None:
    logger.info("Waiting for core services to be available...")
    wait_for_database()
    wait_for_redis()
    logger.info("Core services are available and ready!")


if __name__ == "__main__":
    main()
