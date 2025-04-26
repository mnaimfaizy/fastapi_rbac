#!/bin/sh

export APP_MODULE=${APP_MODULE-app.main:app}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8000}

echo "Running pre-start tasks..."
bash /app/prestart.sh

echo "Starting FastAPI Server..."
fastapi run app/main.py --host $HOST --port $PORT --log-config /app/logging.ini