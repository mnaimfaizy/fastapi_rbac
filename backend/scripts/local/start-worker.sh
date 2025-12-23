#!/bin/bash
set -e

# Change to the backend directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$BACKEND_DIR"

# Add backend directory to PYTHONPATH
if [ -z "$PYTHONPATH" ]; then
    export PYTHONPATH="$BACKEND_DIR"
else
    export PYTHONPATH="$BACKEND_DIR:$PYTHONPATH"
fi

# On Windows, convert PYTHONPATH to use appropriate path separator
case "$(uname -s)" in
    *NT* | CYGWIN* | MINGW* | MSYS*)
        export PYTHONPATH=$(echo $PYTHONPATH | tr ':' ';')
        ;;
esac

# Activate virtual environment if it exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
fi

# Set PYTHONPATH directly before executing python
PYTHONPATH=$PYTHONPATH python -c "import sys; print('Python path:', sys.path)"
# Wait for core services to be available before starting the worker
python ./app/backend_pre_start.py

echo "Starting Celery worker..."
celery -A app.celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2

# If you want to run Celery beat (scheduler) in the same container
# Start with:
# celery -A app.main.celery beat --loglevel=info
