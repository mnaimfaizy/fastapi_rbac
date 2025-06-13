import asyncio
import logging
import sys
from pathlib import Path

# Add the project root directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_init_data() -> None:
    """Create initial database data if it doesn't exist."""
    logger.info("Starting initial data creation process...")
    try:
        async with SessionLocal() as session:
            await init_db(session)
        logger.info("Initial data creation completed successfully")
    except Exception as e:
        logger.error(f"Error during initial data creation: {e}")
        raise


async def main() -> None:
    """Main function to run the initialization."""
    logger.info("Database initial data setup starting...")
    try:
        await create_init_data()
        logger.info("Database initial data setup completed")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
