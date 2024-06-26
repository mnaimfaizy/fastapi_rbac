#!/bin/sh

export APP_MODULE=${APP_MODULE-app.main:app}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-8000}

python /app/app/schedule_cron.py

echo "Staring cron ..."
cron ;
echo "Cron Started "
echo ""
echo "Starting Uvicorn Server..."
uvicorn "$APP_MODULE" --reload --host $HOST --port $PORT --log-config /app/logging.ini