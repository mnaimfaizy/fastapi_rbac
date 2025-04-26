#!/bin/bash
set -e

# Wait for core services to be available before starting Flower
python /app/app/backend_pre_start.py

# Start the Flower monitoring dashboard
# --port=5555: Set the web interface port
# --broker=redis://${REDIS_HOST}:${REDIS_PORT}/0: Use Redis as the broker
# --address=0.0.0.0: Allow access from any IP address

echo "Starting Celery Flower monitoring dashboard..."
celery -A app.celery_app flower --port=5555 --broker=redis://${REDIS_HOST}:${REDIS_PORT}/0 --address=0.0.0.0