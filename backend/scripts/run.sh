#!/bin/sh

export APP_MODULE=${APP_MODULE-app.main:app}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8000}

echo "Running pre-start tasks..."
python -m app.backend_pre_start

echo "Running initial data setup..."
python -m app.initial_data

echo "Starting FastAPI Server..."
fastapi run app/main.py --host $HOST --port $PORT --log-config /app/logging.ini
