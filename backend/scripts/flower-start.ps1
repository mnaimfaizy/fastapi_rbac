#Requires -Version 5.1
# PowerShell equivalent for flower-start.sh

$ErrorActionPreference = 'Stop'

Write-Host "Running pre-start tasks..."
# Execute the Python pre-start script
# Assuming path relative to container root /app
python -m app.backend_pre_start

Write-Host "Starting Celery Flower monitoring dashboard..."
# Retrieve Redis connection details from environment variables
$RedisHost = $env:REDIS_HOST
$RedisPort = $env:REDIS_PORT
# Start the Flower dashboard using Invoke-Expression
# Note the backtick ` before :$RedisPort to escape the colon if needed, though often not required in Invoke-Expression
Invoke-Expression "celery -A app.celery_app flower --port=5555 --broker=redis://$RedisHost`:$RedisPort/0 --address=0.0.0.0"
