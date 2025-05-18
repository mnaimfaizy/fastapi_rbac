import asyncio
import sys
from pathlib import Path

# Add the project root directory to Python path
sys.path.append(str(Path(__file__).parent.parent))

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


async def create_init_data() -> None:
    async with SessionLocal() as session:
        await init_db(session)


async def main() -> None:
    await create_init_data()


if __name__ == "__main__":
    asyncio.run(main())
