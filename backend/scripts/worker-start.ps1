#Requires -Version 5.1
# PowerShell equivalent for worker-start.sh

$ErrorActionPreference = 'Stop'

# Change to the backend directory
$backendPath = Split-Path $PSScriptRoot -Parent
Set-Location $backendPath

# Activate virtual environment if it exists
if (Test-Path ".venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
}

# Add backend directory to PYTHONPATH
$env:PYTHONPATH = $backendPath

Write-Host "Running pre-start tasks..."
# Execute the Python pre-start script using relative path
python .\app\backend_pre_start.py

Write-Host "Starting Celery worker..."
# Start the Celery worker process with specified queues and concurrency
# Use Invoke-Expression to execute the command string
Invoke-Expression "celery -A app.celery_app worker --loglevel=info -Q emails,maintenance,logging,user_management,default,periodic_tasks --concurrency=2"
