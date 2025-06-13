#!/usr/bin/env pwsh
# Development Environment Setup Script
# This script sets up the local development environment with all necessary services

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("setup", "start", "stop", "status", "clean", "help")]
    [string]$Action = "setup",

    [switch]$WithRedis,
    [switch]$WithPostgres,
    [switch]$WithCelery,
    [switch]$SkipFrontend,
    [switch]$ShowDetails,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    switch ($Color) {
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

function Show-Help {
    Write-ColorOutput "`n🚀 Development Environment Setup Script" "Cyan"
    Write-ColorOutput "=========================================" "Cyan"
    Write-ColorOutput "`nThis script sets up the complete local development environment for FastAPI RBAC.`n" "White"

    Write-ColorOutput "📋 Parameters:" "Yellow"
    Write-ColorOutput "  -Action        : Action to perform (setup, start, stop, status, clean)" "White"
    Write-ColorOutput "  -WithRedis     : Include Redis setup" "White"
    Write-ColorOutput "  -WithPostgres  : Include PostgreSQL setup" "White"
    Write-ColorOutput "  -WithCelery    : Include Celery worker setup" "White"
    Write-ColorOutput "  -SkipFrontend  : Skip frontend setup" "White"
    Write-ColorOutput "  -ShowDetails   : Show detailed output" "White"

    Write-ColorOutput "`n💡 Examples:" "Yellow"
    Write-ColorOutput "  .\setup-dev-environment.ps1                          # Complete setup" "White"
    Write-ColorOutput "  .\setup-dev-environment.ps1 -Action start            # Start all services" "White"
    Write-ColorOutput "  .\setup-dev-environment.ps1 -WithRedis -WithPostgres # Setup with specific services" "White"
    Write-ColorOutput "  .\setup-dev-environment.ps1 -Action status           # Check service status" "White"
    Write-ColorOutput "  .\setup-dev-environment.ps1 -Action clean            # Clean and reset environment" "White"

    Write-ColorOutput "`n🎯 Actions:" "Yellow"
    Write-ColorOutput "  setup      : Complete environment setup with prerequisites check" "White"
    Write-ColorOutput "  start      : Start all development services" "White"
    Write-ColorOutput "  stop       : Stop all development services" "White"
    Write-ColorOutput "  status     : Check status of all services" "White"
    Write-ColorOutput "  clean      : Clean and reset development environment" "White"

    Write-ColorOutput "`n🔧 Services:" "Yellow"
    Write-ColorOutput "  Backend     : FastAPI application with hot reload" "White"
    Write-ColorOutput "  Frontend    : React development server" "White"
    Write-ColorOutput "  Database    : PostgreSQL with initialization" "White"
    Write-ColorOutput "  Redis       : Redis cache and session storage" "White"
    Write-ColorOutput "  Celery      : Background task processing" "White"
    Write-ColorOutput "`n"
}

function Test-Command {
    param([string]$Command)

    try {
        Get-Command $Command -ErrorAction Stop > $null
        return $true
    } catch {
        return $false
    }
}

function Test-RedisRunning {
    try {
        $result = & redis-cli ping 2>$null
        return $result -eq "PONG"
    } catch {
        return $false
    }
}

function Install-Dependencies {
    Write-ColorOutput "📦 Installing Dependencies..." "Cyan"

    # Check for Python
    if (-not (Test-Command "python")) {
        Write-ColorOutput "❌ Python not found. Please install Python 3.10+." "Red"
        exit 1
    }

    # Check for Node.js
    if (-not (Test-Command "node")) {
        Write-ColorOutput "❌ Node.js not found. Please install Node.js 18+." "Red"
        exit 1
    }

    # Check for Docker
    if (-not (Test-Command "docker")) {
        Write-ColorOutput "❌ Docker not found. Please install Docker Desktop." "Red"
        exit 1
    }

    Write-ColorOutput "Installing Backend Dependencies..." "Blue"
    Push-Location "$PSScriptRoot\..\..\..\backend"
    & pip install -r requirements.txt
    Pop-Location

    if (-not $SkipFrontend) {
        Write-ColorOutput "Installing Frontend Dependencies..." "Blue"
        Push-Location "$PSScriptRoot\..\..\..\react-frontend"
        & npm install
        Pop-Location
    }

    Write-ColorOutput "✅ Dependencies installed successfully" "Green"
}

function Start-RedisService {
    if ($WithRedis) {
        Write-ColorOutput "🔴 Starting Redis..." "Cyan"

        if (Test-RedisRunning) {
            Write-ColorOutput "✅ Redis is already running" "Green"
        } else {
            # Try to start Redis via Docker
            try {
                docker run -d --name fastapi-rbac-redis-dev -p 6379:6379 redis:7.2-alpine
                Start-Sleep -Seconds 2

                if (Test-RedisRunning) {
                    Write-ColorOutput "✅ Redis started successfully" "Green"
                } else {
                    Write-ColorOutput "❌ Failed to start Redis" "Red"
                }
            } catch {
                Write-ColorOutput "❌ Failed to start Redis: $($_.Exception.Message)" "Red"
            }
        }
    }
}

function Start-PostgresService {
    if ($WithPostgres) {
        Write-ColorOutput "🐘 Starting PostgreSQL..." "Cyan"

        try {
            # Check if already running
            $existing = docker ps --filter "name=fastapi-rbac-postgres-dev" --format "{{.Names}}"

            if ($existing) {
                Write-ColorOutput "✅ PostgreSQL is already running" "Green"
            } else {
                docker run -d --name fastapi-rbac-postgres-dev `
                    -e POSTGRES_USER=postgres `
                    -e POSTGRES_PASSWORD=postgres `
                    -e POSTGRES_DB=fastapi_rbac_dev `
                    -p 5432:5432 `
                    postgres:15

                Start-Sleep -Seconds 5
                Write-ColorOutput "✅ PostgreSQL started successfully" "Green"
            }
        } catch {
            Write-ColorOutput "❌ Failed to start PostgreSQL: $($_.Exception.Message)" "Red"
        }
    }
}

function Start-CeleryServices {
    if ($WithCelery) {
        Write-ColorOutput "🌿 Starting Celery Services..." "Cyan"

        Push-Location "$PSScriptRoot\..\..\..\backend"

        try {
            # Start Celery worker in background
            Write-ColorOutput "Starting Celery worker..." "Blue"
            Start-Process -FilePath "python" -ArgumentList "-m", "celery", "-A", "app.celery_app", "worker", "--loglevel=info" -WindowStyle Minimized

            # Start Celery beat in background
            Write-ColorOutput "Starting Celery beat..." "Blue"
            Start-Process -FilePath "python" -ArgumentList "-m", "celery", "-A", "app.celery_app", "beat", "--loglevel=info" -WindowStyle Minimized

            Write-ColorOutput "✅ Celery services started" "Green"
        } catch {
            Write-ColorOutput "❌ Failed to start Celery: $($_.Exception.Message)" "Red"
        } finally {
            Pop-Location
        }
    }
}

function Stop-DevelopmentServices {
    Write-ColorOutput "🛑 Stopping Development Services..." "Cyan"

    # Stop Redis
    try {
        docker stop fastapi-rbac-redis-dev 2>$null
        docker rm fastapi-rbac-redis-dev 2>$null
        Write-ColorOutput "✅ Redis stopped" "Green"
    } catch {
        Write-ColorOutput "⚠️  Redis was not running" "Yellow"
    }

    # Stop PostgreSQL
    try {
        docker stop fastapi-rbac-postgres-dev 2>$null
        docker rm fastapi-rbac-postgres-dev 2>$null
        Write-ColorOutput "✅ PostgreSQL stopped" "Green"
    } catch {
        Write-ColorOutput "⚠️  PostgreSQL was not running" "Yellow"
    }

    # Stop Celery processes
    try {
        Get-Process | Where-Object { $_.ProcessName -eq "python" -and $_.CommandLine -like "*celery*" } | Stop-Process -Force
        Write-ColorOutput "✅ Celery processes stopped" "Green"
    } catch {
        Write-ColorOutput "⚠️  No Celery processes found" "Yellow"
    }
}

function Show-ServiceStatus {
    Write-ColorOutput "📊 Development Services Status" "Cyan"
    Write-ColorOutput "=============================" "Cyan"

    # Redis status
    if (Test-RedisRunning) {
        Write-ColorOutput "🔴 Redis: Running" "Green"
    } else {
        Write-ColorOutput "🔴 Redis: Not running" "Red"
    }

    # PostgreSQL status
    $pgStatus = docker ps --filter "name=fastapi-rbac-postgres-dev" --format "{{.Status}}"
    if ($pgStatus) {
        Write-ColorOutput "🐘 PostgreSQL: Running" "Green"
    } else {
        Write-ColorOutput "🐘 PostgreSQL: Not running" "Red"
    }

    # Celery status
    $celeryProcs = Get-Process | Where-Object { $_.ProcessName -eq "python" -and $_.CommandLine -like "*celery*" }
    if ($celeryProcs) {
        Write-ColorOutput "🌿 Celery: Running ($($celeryProcs.Count) processes)" "Green"
    } else {
        Write-ColorOutput "🌿 Celery: Not running" "Red"
    }
}

function Clean-DevelopmentEnvironment {
    Write-ColorOutput "🧹 Cleaning Development Environment..." "Cyan"

    # Stop services first
    Stop-DevelopmentServices

    # Clean Python cache
    Write-ColorOutput "Cleaning Python cache..." "Blue"
    Get-ChildItem -Path "$PSScriptRoot\..\..\..\backend" -Recurse -Name "__pycache__" | Remove-Item -Recurse -Force
    Get-ChildItem -Path "$PSScriptRoot\..\..\..\backend" -Recurse -Name "*.pyc" | Remove-Item -Force

    # Clean Node.js cache
    if (-not $SkipFrontend) {
        Write-ColorOutput "Cleaning Node.js cache..." "Blue"
        Push-Location "$PSScriptRoot\..\..\..\react-frontend"
        & npm run clean 2>$null
        Pop-Location
    }

    Write-ColorOutput "✅ Development environment cleaned" "Green"
}

# Main execution
# Check for help request
if ($Help -or $Action -eq "help") {
    Show-Help
    exit 0
}

Write-ColorOutput "🚀 FastAPI RBAC Development Environment Manager" "Blue"
Write-ColorOutput "===============================================" "Blue"
Write-ColorOutput "Action: $Action" "White"
Write-ColorOutput ""

switch ($Action) {
    "setup" {
        Install-Dependencies
        Start-RedisService
        Start-PostgresService
        Start-CeleryServices
        Write-ColorOutput "`n🎉 Development environment setup completed!" "Green"
        Write-ColorOutput "You can now start the backend with: python -m uvicorn app.main:app --reload" "Cyan"
        if (-not $SkipFrontend) {
            Write-ColorOutput "You can start the frontend with: npm run dev" "Cyan"
        }
    }
    "start" {
        Start-RedisService
        Start-PostgresService
        Start-CeleryServices
        Write-ColorOutput "`n✅ Development services started!" "Green"
    }
    "stop" {
        Stop-DevelopmentServices
        Write-ColorOutput "`n✅ Development services stopped!" "Green"
    }
    "status" {
        Show-ServiceStatus
    }
    "clean" {
        Clean-DevelopmentEnvironment
        Write-ColorOutput "`n✅ Development environment cleaned!" "Green"
    }
}

Write-ColorOutput "`n💡 Use -WithRedis, -WithPostgres, -WithCelery to control specific services" "Yellow"
