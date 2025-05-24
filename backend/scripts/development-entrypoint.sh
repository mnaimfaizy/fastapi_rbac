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

# Define exclude patterns for auto-reload
EXCLUDE_PATTERNS=(
    '*/logs/*'          # Exclude all files in logs directory
    '*.log'             # Exclude all log files
    '*/__pycache__/*'   # Exclude Python cache
    '*.pyc'             # Exclude Python compiled files
    '*/.pytest_cache/*' # Exclude pytest cache
    '*/.mypy_cache/*'   # Exclude mypy cache
)

# Join patterns with comma for uvicorn, handling potential empty array if no patterns
IFS=','
EXCLUDE_STR="${EXCLUDE_PATTERNS[*]}"

echo "Starting uvicorn with watch patterns excluded: $EXCLUDE_STR"
# Use uvicorn directly for more control over reload excludes, similar to the PowerShell script
uvicorn app.main:fastapi_app --reload --reload-exclude="$EXCLUDE_STR" --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
