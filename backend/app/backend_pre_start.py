import logging
import os

import tenacity
from sqlalchemy import create_engine, text

from app.core.config import ModeEnum, settings

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
        masked_uri = database_uri.replace(settings.DATABASE_PASSWORD, "****") if database_uri else "None"
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

        # Get Redis connection details based on environment mode
        if settings.MODE == ModeEnum.development:
            redis_host = "localhost"  # Use local Redis for development
            redis_port = 6379
            logger.info("Development mode: Using local Redis.")
        elif settings.MODE == ModeEnum.testing:
            # Use configured Redis for testing (likely Docker)
            redis_host = os.getenv("REDIS_HOST", settings.REDIS_HOST)
            redis_port = int(os.getenv("REDIS_PORT", settings.REDIS_PORT))
            logger.info("Testing mode: Using configured Redis (Docker/settings).")
        else:  # Production or other modes
            # Default to environment variables or settings
            redis_host = os.getenv("REDIS_HOST", settings.REDIS_HOST)
            redis_port = int(os.getenv("REDIS_PORT", settings.REDIS_PORT))
            logger.info(f"{settings.MODE.value} mode: Using configured Redis.")

        logger.info(f"Connecting to Redis at {redis_host}:{redis_port}")
        redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=0,
            socket_connect_timeout=1,
        )
        redis_client.ping()
        logger.info("Redis is ready")
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
