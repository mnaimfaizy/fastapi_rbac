import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

from alembic import context

# Add the project root directory (backend) to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.config import Settings

# Import models for Alembic to detect
from app.models import *  # noqa

settings = Settings()
# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)


target_metadata = SQLModel.metadata

db_url = str(settings.ASYNC_DATABASE_URI)
# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline():
    """Run migrations in 'offline' mode.
    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.
    Calls to context.execute() here emit the given string to the
    script output.
    """
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        render_as_batch=True,  # Add this for SQLite compatibility
        dialect_opts={"paramstyle": "named"},  # Corrected this line
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=True,  # Add this for SQLite compatibility
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online():
    """Run migrations in 'online' mode.
    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = create_async_engine(db_url, echo=True, future=True)

    async with connectable.connect() as connection:
        # Pass render_as_batch=True also to the run_sync context
        await connection.run_sync(lambda conn: do_run_migrations(conn))


if context.is_offline_mode():
    # For offline mode, ensure render_as_batch is also set
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},  # Corrected this line
        render_as_batch=True,  # Add for offline mode too
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_migrations_online())
