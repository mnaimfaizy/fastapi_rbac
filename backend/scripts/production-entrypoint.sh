#!/bin/bash

echo "=== FastAPI RBAC Production Environment ==="

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
  echo "PostgreSQL unavailable - sleeping for 2 seconds"
  sleep 2
done
echo "PostgreSQL is ready!"

echo "Starting database initialization..."
# Let the DB start
python ./app/backend_pre_start.py

# Run migrations
echo "Running database migrations..."
alembic upgrade head

# Create initial data in DB (only if not exists)
echo "Setting up initial data..."
python ./app/initial_data.py

echo "Starting FastAPI production server..."
# Use Gunicorn with Uvicorn workers for production
exec gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --log-level info --access-logfile - --error-logfile -
