#!/usr/bin/env python
"""
Script to initialize the database with initial data.
This script can be run directly from the backend directory.
"""
import asyncio
import logging

# Import app modules
from app.db.init_db import init_db
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_init_data() -> None:
    """Create initial database data."""
    logger.info("Creating initial data")
    async with SessionLocal() as session:
        await init_db(session)
    logger.info("Initial data created successfully")


async def main() -> None:
    """Main function to run the initialization."""
    logger.info("Initializing the database with initial data")
    await create_init_data()
    logger.info("Database initialization complete")


if __name__ == "__main__":
    asyncio.run(main())
