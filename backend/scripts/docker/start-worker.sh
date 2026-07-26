#!/bin/bash
set -e

# Set PYTHONPATH to /app (Docker best practice for this project)
export PYTHONPATH="/app"

# Wait for core services to be available before starting the worker
python ./app/backend_pre_start.py

echo "Starting Celery worker..."
# Load app.worker so @celery_app.task handlers are registered (not just the app).
exec celery -A app.worker:celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2
