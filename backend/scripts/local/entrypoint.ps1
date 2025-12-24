#Requires -Version 5.1
# PowerShell equivalent for entrypoint.sh

$ErrorActionPreference = 'Stop'
Write-Host "=== FastAPI RBAC System Entrypoint ==="

# Function to wait for PostgreSQL (same as in development-entrypoint.ps1)
function Wait-PostgresReady {
    param(
        [string]$DbHost = $env:DATABASE_HOST,
        [string]$DbPort = $env:DATABASE_PORT,
        [string]$DbUser = $env:DATABASE_USER,
        [string]$DbPassword = $env:DATABASE_PASSWORD,
        [string]$DbName = $env:DATABASE_NAME
    )
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
    sys.exit(0)
else:
    sys.exit(1)
"@
    try {
        python -c $pythonScript
        return $true
    } catch {
        return $false
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
# Run Python pre-start script (using path relative to container /app)
python ./app/backend_pre_start.py

# Run Alembic migrations
alembic upgrade head

# Run initial data seeding script
python ./app/initial_data.py

Write-Host "Starting FastAPI application..."
# Determine host and port for production/container environment
$HostAddr = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$AppPort = if ($env:PORT) { $env:PORT } else { "8000" }
# Start FastAPI using 'run' for production
Invoke-Expression "fastapi run app/main.py --host $HostAddr --port $AppPort"
