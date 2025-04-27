#!/bin/bash
set -e

# Wait for core services to be available before starting the scheduler
python /app/app/backend_pre_start.py

# Start the Celery beat scheduler
# -A app.celery_app: Specify the Celery application
# --loglevel=info: Set logging level
# -s /app/celerybeat-schedule: Specify the schedule file location

echo "Starting Celery beat scheduler..."
celery -A app.celery_app beat --loglevel=info -s /app/celerybeat-schedule.db