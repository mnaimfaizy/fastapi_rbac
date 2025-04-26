\
#Requires -Version 5.1
# PowerShell equivalent for worker-start.sh

$ErrorActionPreference = 'Stop'

Write-Host "Running pre-start tasks..."
# Execute the Python pre-start script
# Assuming path relative to container root /app
python /app/app/backend_pre_start.py

Write-Host "Starting Celery worker..."
# Start the Celery worker process with specified queues and concurrency
# Use Invoke-Expression to execute the command string
Invoke-Expression "celery -A app.celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2"
