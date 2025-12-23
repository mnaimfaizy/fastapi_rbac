#Requires -Version 5.1
# PowerShell equivalent for run.sh

$ErrorActionPreference = 'Stop'

# Set environment variables with defaults if not already set
$env:APP_MODULE = if ($env:APP_MODULE) { $env:APP_MODULE } else { "app.main:app" }
$env:HOST = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$env:PORT = if ($env:PORT) { $env:PORT } else { "8000" }

Write-Host "Running pre-start tasks..."
# Execute the Python pre-start script (assuming path relative to container root /app)
python -m app.backend_pre_start

Write-Host ""
# Execute the Python initial data script (assuming path relative to container root /app)
python -m app.initial_data

Write-Host "Starting FastAPI Server..."
# Start the FastAPI server using configured host, port, and logging config
# Assuming logging.ini is at /app/logging.ini in the container
Invoke-Expression "uvicorn $env:APP_MODULE --host $env:HOST --port $env:PORT --log-config logging.ini"
