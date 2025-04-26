\
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

Write-Host "Starting FastAPI development server with auto-reload..."
# Determine host and port, using defaults if environment variables are not set
$HostAddr = if ($env:HOST) { $env:HOST } else { "127.0.0.1" }
$AppPort = if ($env:PORT) { $env:PORT } else { "8000" }
# Start FastAPI in development mode using Invoke-Expression
Invoke-Expression "fastapi dev app/main.py --host $HostAddr --port $AppPort"
