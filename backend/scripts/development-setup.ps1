# PowerShell script for setting up the development environment on Windows
# This script helps run Redis and Celery for local development

# Function to check if Redis is running
function Check-Redis {
    try {
        # Try to connect to Redis
        $result = & redis-cli ping
        if ($result -eq "PONG") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Function to start Redis
function Start-Redis {
    Write-Host "Starting Redis server for development..."

    # Check if Redis is already running
    if (Check-Redis) {
        Write-Host "Redis is already running."
        return
    }

    # Try to start Redis
    try {
        Start-Process -FilePath "redis-server" -NoNewWindow -RedirectStandardOutput "redis-output.log"
        Write-Host "Redis started successfully. Check redis-output.log for details."
    } catch {
        Write-Host "Failed to start Redis. Make sure Redis is installed and in your PATH."
        Write-Host "Download Redis for Windows from: https://github.com/microsoftarchive/redis/releases"
        Write-Host "Or use WSL2 to run Redis."
    }
}

# Function to stop Redis
function Stop-Redis {
    Write-Host "Stopping Redis server..."
    try {
        & redis-cli shutdown
        Write-Host "Redis stopped successfully."
    } catch {
        Write-Host "Failed to stop Redis. It might not be running or there was an error."
    }
}

# Start Celery worker for development
function Start-CeleryWorker {
    Write-Host "Starting Celery worker for development..."
    # Set the environment variable to ensure Celery uses the development configuration
    $env:MODE = "development"

    # Start Celery worker
    try {
        celery -A app.main.celery worker --loglevel=info
    } catch {
        Write-Host "Failed to start Celery worker. Make sure Celery is installed."
        Write-Host "Install with: pip install celery"
    }
}

# Start Celery beat for development
function Start-CeleryBeat {
    Write-Host "Starting Celery beat for scheduled tasks..."
    $env:MODE = "development"

    try {
        celery -A app.main.celery beat --loglevel=info
    } catch {
        Write-Host "Failed to start Celery beat. Make sure Celery is installed."
    }
}

# Show usage information
function Show-Usage {
    Write-Host "Usage: .\development-setup.ps1 [command]"
    Write-Host "Commands:"
    Write-Host "  start-redis    - Start Redis server"
    Write-Host "  stop-redis     - Stop Redis server"
    Write-Host "  start-worker   - Start Celery worker"
    Write-Host "  start-beat     - Start Celery beat scheduler"
    Write-Host "  check-redis    - Check if Redis is running"
    Write-Host "  help           - Show this help message"
}

# Main command handling
$command = $args[0]

switch ($command) {
    "start-redis" {
        Start-Redis
    }
    "stop-redis" {
        Stop-Redis
    }
    "start-worker" {
        Start-CeleryWorker
    }
    "start-beat" {
        Start-CeleryBeat
    }
    "check-redis" {
        if (Check-Redis) {
            Write-Host "Redis is running."
        } else {
            Write-Host "Redis is not running."
        }
    }
    "help" {
        Show-Usage
    }
    default {
        Show-Usage
    }
}
