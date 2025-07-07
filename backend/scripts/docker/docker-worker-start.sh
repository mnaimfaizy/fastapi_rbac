#!/bin/bash
set -e

# Set PYTHONPATH to /backend (Docker default)
export PYTHONPATH="/backend"

# Wait for core services to be available before starting the worker
python ./app/backend_pre_start.py

echo "Starting Celery worker..."
exec celery -A app.celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2
