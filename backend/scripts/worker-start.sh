#!/bin/bash
set -e

# Wait for core services to be available before starting the worker
python /app/app/backend_pre_start.py

# Celery worker options
# -A app.celery_app: Specify the Celery application
# --loglevel=info: Set logging level
# -Q emails,maintenance,logging,user_management,default,periodic_tasks: Include all defined queues
# --concurrency=2: Set the number of worker processes

echo "Starting Celery worker..."
celery -A app.celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2

# If you want to run Celery beat (scheduler) in the same container
# Start with:
# celery -A app.main.celery beat --loglevel=info