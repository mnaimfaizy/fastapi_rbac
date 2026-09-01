#!/bin/bash

echo "=== FastAPI RBAC System Testing Entrypoint ==="
echo "Environment: ${ENVIRONMENT:-testing}"
echo "Mode: ${MODE:-testing}"

# Ensure /app/.coverage is a file, not a directory, before running pytest
if [ -d /app/.coverage ]; then
  echo "/app/.coverage is a directory, removing it to avoid coverage errors..."
  rm -rf /app/.coverage
fi
if [ ! -f /app/.coverage ]; then
  echo "Creating empty /app/.coverage file."
  touch /app/.coverage
fi

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
        print(f"Database connection failed: {e}")
        return False

async def main():
    result = await test_connection()
    sys.exit(0 if result else 1)

asyncio.run(main())
END
}

# Function to wait for Redis to be ready
function redis_ready() {
  python << END
import sys
import redis

try:
    r = redis.Redis(host="${REDIS_HOST}", port="${REDIS_PORT}", decode_responses=True)
    r.ping()
    print("Redis connection successful")
    sys.exit(0)
except Exception as e:
    print(f"Redis connection failed: {e}")
    sys.exit(1)
END
}

echo "Waiting for PostgreSQL to be available..."
until postgres_ready; do
  echo "PostgreSQL is unavailable - sleeping..."
  sleep 5
done
echo "✅ PostgreSQL is available"

echo "Waiting for Redis to be available..."
until redis_ready; do
  echo "Redis is unavailable - sleeping..."
  sleep 5
done
echo "✅ Redis is available"

# Run database migrations
echo "Running database migrations..."
alembic upgrade head
echo "✅ Database migrations completed"

# Initialize database with test data if needed
if [ "${INIT_TEST_DATA:-false}" = "true" ]; then
    echo "Initializing test data..."
    python -m app.initial_data
    echo "✅ Test data initialized"
fi

# Set environment for testing
export PYTHONPATH=/app
export TESTING=1
export FASTAPI_ENV=testing

# Build extra pytest args from environment variables
PYTEST_ARGS=""
if [ "$VERBOSE" = "1" ]; then
  PYTEST_ARGS="$PYTEST_ARGS -v -s"
fi
if [ "$PARALLEL" = "1" ]; then
  PYTEST_ARGS="$PYTEST_ARGS -n auto"
fi
if [ "$FAST" = "1" ]; then
  PYTEST_ARGS="$PYTEST_ARGS -m 'not slow'"
fi

# If running as test runner, execute pytest and exit
if [ -n "$TEST_PATH" ]; then
  echo "TEST_PATH is set: $TEST_PATH"
  cd /app
  if [ "$COVERAGE" = "1" ]; then
    # This measures the pytest process itself, so it is only meaningful for
    # suites that import and call app/ in-process -- TEST_PATH=test/unit.
    # For test/integration the app runs in the separate fastapi_rbac_test
    # container and is driven over HTTP, so this reports almost nothing;
    # set SERVER_COVERAGE=1 on that service instead.
    echo "Running targeted tests with coverage: pytest $TEST_PATH $PYTEST_ARGS --cov=app --cov-report=html:htmlcov --cov-report=xml:coverage.xml --cov-report=term-missing"
    pytest $TEST_PATH $PYTEST_ARGS --cov=app --cov-report=html:htmlcov --cov-report=xml:coverage.xml --cov-report=term-missing
  else
    echo "Running targeted tests: pytest $TEST_PATH $PYTEST_ARGS"
    pytest $TEST_PATH $PYTEST_ARGS
  fi
  # Capture pytest's status now. Everything below is diagnostics and chmod, and
  # each one overwrites $? -- exiting on it after the fact reported success for
  # a failing suite, which let the runner container exit 0 with tests red.
  PYTEST_STATUS=$?
  # Diagnostics: List coverage files and htmlcov directory
  echo "\n=== Coverage Diagnostics ==="
  ls -l /app/.coverage || echo ".coverage file not found"
  ls -l /app/coverage.xml || echo "coverage.xml not found"
  ls -l /app/htmlcov || echo "htmlcov directory not found"
  echo "Contents of /app/htmlcov (if exists):"
  ls -l /app/htmlcov/* 2>/dev/null || echo "No files in htmlcov"
  echo "============================\n"
  # Fix permissions so coverage files are accessible on the host
  echo "Fixing permissions on coverage files..."
  if [ -f /app/.coverage ]; then
    chmod 666 /app/.coverage && echo "Set permissions on .coverage"
  else
    echo ".coverage file not found for chmod"
  fi
  if [ -f /app/coverage.xml ]; then
    chmod 666 /app/coverage.xml && echo "Set permissions on coverage.xml"
  else
    echo "coverage.xml not found for chmod"
  fi
  if [ -d /app/htmlcov ]; then
    chmod -R 777 /app/htmlcov && echo "Set permissions on htmlcov directory"
  else
    echo "htmlcov directory not found for chmod"
  fi
  echo "Permission fix complete."
  echo "pytest exit status: $PYTEST_STATUS"
  exit "$PYTEST_STATUS"
fi

# Default: Start the FastAPI application in testing mode

echo "Starting FastAPI application in testing mode..."
echo "API will be available at http://0.0.0.0:8000"

# Start the FastAPI application with testing-optimized settings
UVICORN_ARGS=(app.main:app --host 0.0.0.0 --port 8000 --log-level info --access-log --use-colors)

if [ "$SERVER_COVERAGE" = "1" ]; then
  # Integration tests drive this server over HTTP from a separate container, so
  # app/ executes here and nowhere else. Coverage for that suite has to be
  # collected in this process; measuring the test runner reports almost nothing,
  # because the runner only ever imports config, models and schemas.
  #
  # --save-signal makes coverage write its data file on USR1. This container is
  # not stopped when the test runner exits, so CI sends USR1 once the suite is
  # done and reads the file off the bind mount before tearing the stack down.
  #
  # Do not rely on shutdown instead: uvicorn does not exit within Docker's grace
  # period here, so the container is SIGKILLed (exit 137) and coverage never
  # writes anything. USR1 is the only reliable trigger.
  #
  # No --reload here: the reloader runs the app in a child process, so coverage
  # would measure the supervisor and miss everything that matters.
  echo "Starting under coverage (data file: ${COVERAGE_FILE:-/app/.coverage})"
  exec coverage run --save-signal=USR1 --source=app -m uvicorn "${UVICORN_ARGS[@]}"
else
  exec uvicorn "${UVICORN_ARGS[@]}" --reload
fi
