#!/bin/bash
set -e

# Set PYTHONPATH to /app (Docker best practice for this project)
export PYTHONPATH="/app"

# Wait for core services to be available before starting the beat scheduler
python ./app/backend_pre_start.py

echo "Starting Celery beat scheduler..."
# Start the Celery beat process and explicitly set the schedule file path for persistence
exec celery -A app.celery_app beat --loglevel=info --schedule=/app/celerybeat-schedule.db
