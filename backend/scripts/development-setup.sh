#!/bin/bash
# Development setup script for FastAPI RBAC project

# Ensure the script exits on any error
set -e

# Check if Redis is installed locally
if ! command -v redis-server &> /dev/null; then
  echo "Redis is not installed. Please install Redis first."
  echo "For Windows: Use Windows Subsystem for Linux (WSL) or Redis Windows port."
  echo "For macOS: brew install redis"
  echo "For Linux: apt-get install redis-server or equivalent"
  exit 1
fi

# Function to start Redis in the background
start_redis() {
  echo "Starting Redis server for development..."
  if [ -f "/etc/init.d/redis-server" ]; then
    # For systems with systemd/init.d
    sudo service redis-server start
  else
    # For direct command
    redis-server --daemonize yes
  fi
  echo "Redis started successfully."
}

# Function to stop Redis
stop_redis() {
  echo "Stopping Redis server..."
  if [ -f "/etc/init.d/redis-server" ]; then
    # For systems with systemd/init.d
    sudo service redis-server stop
  else
    # For direct command
    redis-cli shutdown
  fi
  echo "Redis stopped successfully."
}

# Start Celery worker for development
start_celery_worker() {
  echo "Starting Celery worker for development..."
  # Use the environment variable to ensure Celery uses the development configuration
  export MODE=development
  celery -A app.main.celery worker --loglevel=info
}

# Print usage information
usage() {
  echo "Usage: ./development-setup.sh [command]"
  echo "Commands:"
  echo "  start-redis    - Start Redis server"
  echo "  stop-redis     - Stop Redis server"
  echo "  start-worker   - Start Celery worker"
  echo "  start-dev      - Start both Redis and Celery worker"
  echo "  help           - Show this help message"
}

# Main command switch
case "$1" in
  start-redis)
    start_redis
    ;;
  stop-redis)
    stop_redis
    ;;
  start-worker)
    start_celery_worker
    ;;
  start-dev)
    start_redis
    start_celery_worker
    ;;
  help|*)
    usage
    ;;
esac
