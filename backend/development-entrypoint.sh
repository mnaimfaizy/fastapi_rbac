#!/bin/bash

echo "=== FastAPI RBAC System Development Mode ==="

# Function to wait for PostgreSQL to be ready
function postgres_ready() {
  python << END
import sys
import asyncio
from asyncpg.connection import connect

async def test_connection():
    try:
        conn = await connect(
            host="${DATABASE_HOST}",
            port="${DATABASE_PORT}",
            user="${DATABASE_USER}",
            password="${DATABASE_PASSWORD}",
            database="${DATABASE_NAME}"
        )
        await conn.close()
        return True
    except Exception as e:
        print(f"Database connection error: {e}")
        return False

if asyncio.run(test_connection()):
    sys.exit(0)
else:
    sys.exit(1)
END
}

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until postgres_ready; do
  echo "PostgreSQL unavailable - sleeping for 1 second"
  sleep 1
done
echo "PostgreSQL is ready!"

echo "Starting database initialization..."
# Let the DB start
python ./app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB
python ./app/initial_data.py

echo "Starting FastAPI development server with auto-reload..."
# Use FastAPI CLI dev mode for development
fastapi dev app/main.py --host ${HOST:-127.0.0.1} --port ${PORT:-8000}