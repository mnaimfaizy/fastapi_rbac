#Requires -Version 5.1
# PowerShell equivalent for beat-start.sh

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

Write-Host "Starting Celery beat scheduler..."
# Start the Celery beat process with SQLite scheduler instead of Django
Invoke-Expression "celery -A app.celery_app beat --loglevel=info -s ./celerybeat-schedule.db --scheduler=celery.beat.PersistentScheduler"
