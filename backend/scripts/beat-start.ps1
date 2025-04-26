\
#Requires -Version 5.1
# PowerShell equivalent for beat-start.sh

$ErrorActionPreference = 'Stop'

Write-Host "Running pre-start tasks..."
# Execute the Python pre-start script
# Assuming python is in PATH and script path is relative to container root
python /app/app/backend_pre_start.py

Write-Host "Starting Celery beat scheduler..."
# Start the Celery beat process
# Ensure celery command is available in the environment's PATH
# Use Invoke-Expression to run the command string
Invoke-Expression "celery -A app.celery_app beat --loglevel=info -s /app/celerybeat-schedule.db"
