#Requires -Version 5.1
# PowerShell equivalent for development-entrypoint.sh

$ErrorActionPreference = 'Stop'
Write-Host "=== FastAPI RBAC System Development Mode ==="

# Function to wait for PostgreSQL to be ready
function Wait-PostgresReady {
    param(
        [string]$DbHost = $env:DATABASE_HOST,
        [string]$DbPort = $env:DATABASE_PORT,
        [string]$DbUser = $env:DATABASE_USER,
        [string]$DbPassword = $env:DATABASE_PASSWORD,
        [string]$DbName = $env:DATABASE_NAME
    )
    # Inline Python script to check DB connection
    # Note: Ensure asyncpg is installed in the Python environment
    $pythonScript = @"
import sys
import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect(
            host='$DbHost',
            port='$DbPort',
            user='$DbUser',
            password='$DbPassword',
            database='$DbName'
        )
        await conn.close()
        return True
    except Exception as e:
        print(f"Database connection error: {e}", file=sys.stderr)
        return False

if asyncio.run(test_connection()):
    sys.exit(0) # Success
else:
    sys.exit(1) # Failure
"@
    try {
        # Execute the Python script. PowerShell captures stderr and throws if exit code is non-zero.
        python -c $pythonScript
        return $true # Connection successful if no exception is thrown
    } catch {
        # Catch block executes if python exits with non-zero code (connection failed)
        # Write-Error $_ # Optionally log the error details
        return $false # Connection failed
    }
}

# Wait loop for PostgreSQL
Write-Host "Waiting for PostgreSQL..."
while (-not (Wait-PostgresReady)) {
    Write-Host "PostgreSQL unavailable - sleeping for 1 second"
    Start-Sleep -Seconds 1
}
Write-Host "PostgreSQL is ready!"

Write-Host "Starting database initialization..."
# Run Python pre-start script (relative path for local dev)
python ./app/backend_pre_start.py

# Run Alembic migrations
# Ensure alembic command is in PATH
alembic upgrade head

# Run initial data seeding script
python ./app/initial_data.py

function Start-UvicornServer {
    $excludePatterns = @(
        '*/logs/*',          # Exclude all files in logs directory
        '*.log',             # Exclude all log files
        '*/__pycache__/*',   # Exclude Python cache
        '*.pyc',             # Exclude Python compiled files
        '*/.pytest_cache/*',  # Exclude pytest cache
        '*/.mypy_cache/*'    # Exclude mypy cache
    )

    # Join patterns with comma for uvicorn
    $excludeStr = $excludePatterns -join ','

    Write-Host "Starting uvicorn with watch patterns excluded: $excludeStr"
    uvicorn app.main:fastapi_app --reload --reload-exclude="$excludeStr" --host 0.0.0.0 --port 8000
}

Write-Host "Starting FastAPI development server with auto-reload..."

# Start the uvicorn server with our configured watch settings
Start-UvicornServer
