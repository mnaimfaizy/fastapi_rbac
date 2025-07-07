#!/usr/bin/env pwsh
# FastAPI RBAC Docker Environment Manager
# Usage: .\docker-env.ps1 -Environment dev|test|prod [-Action up|down|build|status|logs|prune] [-Help]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "test", "prod")]
    [string]$Environment = "dev",

    [Parameter(Mandatory=$false)]
    [ValidateSet("up", "down", "build", "status", "logs", "prune")]
    [string]$Action = "up",

    [switch]$Help
)

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Show-Help {
    Write-ColorOutput ""
    Write-ColorOutput "FastAPI RBAC Docker Environment Manager" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput ""
    Write-ColorOutput "Usage:" "Yellow"
    Write-ColorOutput "  .\docker-env.ps1 -Environment dev|test|prod [-Action up|down|build|status|logs|prune] [-Help]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Parameters:" "Yellow"
    Write-ColorOutput "  -Environment : dev (default), test, prod" "White"
    Write-ColorOutput "  -Action      : up (default), down, build, status, logs, prune" "White"
    Write-ColorOutput "  -Help        : Show this help message" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Yellow"
    Write-ColorOutput "  .\docker-env.ps1" "White"
    Write-ColorOutput "  .\docker-env.ps1 -Environment test -Action up" "White"
    Write-ColorOutput "  .\docker-env.ps1 -Environment prod -Action build" "White"
    Write-ColorOutput "  .\docker-env.ps1 -Help" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Actions:" "Yellow"
    Write-ColorOutput "  up     : Build and start all containers (default)" "White"
    Write-ColorOutput "  down   : Stop and remove all containers" "White"
    Write-ColorOutput "  build  : Build images only" "White"
    Write-ColorOutput "  status : Show running containers" "White"
    Write-ColorOutput "  logs   : Show logs (Ctrl+C to exit)" "White"
    Write-ColorOutput "  prune  : Prune unused Docker resources" "White"
    Write-ColorOutput ""
}

if ($Help) {
    Show-Help
    exit 0
}

# Compose file selection
switch ($Environment) {
    "dev"  { $composeFiles = @("backend/docker-compose.dev.yml", "react-frontend/docker-compose.dev.yml"); $projectName = "fastapi_rbac_dev"; $networkName = "fastapi_rbac_dev_network" }
    "test" { $composeFiles = @("backend/docker-compose.test.yml", "react-frontend/docker-compose.test.yml"); $projectName = "fastapi_rbac_test"; $networkName = "fastapi_rbac_test_network" }
    "prod" { $composeFiles = @("backend/docker-compose.prod.yml", "react-frontend/docker-compose.prod.yml"); $projectName = "fastapi_rbac_production"; $networkName = "fastapi_rbac_prod_network" }
    default { Write-ColorOutput "Unknown environment: $Environment" "Red"; exit 1 }
}

$composeArgs = ($composeFiles | ForEach-Object { "-f $_" }) -join " "
$projectArg = "-p $projectName"

switch ($Action) {
    "up" {
        Write-ColorOutput "🚀 Starting $Environment environment..." "Cyan"
        # Create the external network if it does not exist
        if (-not (docker network ls --format '{{.Name}}' | Select-String -Pattern "^$networkName$")) {
            Write-ColorOutput "Creating external Docker network: $networkName" "Green"
            docker network create $networkName | Out-Null
        }
        # Set REACT_FRONTEND_SRC and BACKEND_SRC for dev, prod, and test environments
        if ($Environment -eq "dev" -or $Environment -eq "prod" -or $Environment -eq "test") {
            $env:REACT_FRONTEND_SRC = "../react-frontend"
            $env:BACKEND_SRC = "../backend"
        }
        $cmd = "docker compose $composeArgs $projectArg up -d --build"
        Invoke-Expression $cmd
    }
    "down" {
        Write-ColorOutput "🛑 Stopping $Environment environment..." "Yellow"
        $cmd = "docker compose $composeArgs $projectArg down -v"
        Invoke-Expression $cmd
        # Remove the external network if it exists
        if (docker network ls --format '{{.Name}}' | Select-String -Pattern "^$networkName$") {
            Write-ColorOutput "Removing external Docker network: $networkName" "Green"
            docker network rm $networkName | Out-Null
        }
        # Unset REACT_FRONTEND_SRC and BACKEND_SRC after down for dev, prod, and test
        if ($Environment -eq "dev" -or $Environment -eq "prod" -or $Environment -eq "test") {
            Remove-Item Env:REACT_FRONTEND_SRC -ErrorAction SilentlyContinue
            Remove-Item Env:BACKEND_SRC -ErrorAction SilentlyContinue
        }
    }
    "build" {
        Write-ColorOutput "🔨 Building images for $Environment..." "Cyan"
        if ($Environment -eq "dev" -or $Environment -eq "prod" -or $Environment -eq "test") {
            $env:REACT_FRONTEND_SRC = "../react-frontend"
            $env:BACKEND_SRC = "../backend"
        }
        $cmd = "docker compose $composeArgs $projectArg build --no-cache"
        Invoke-Expression $cmd
        if ($Environment -eq "dev" -or $Environment -eq "prod" -or $Environment -eq "test") {
            Remove-Item Env:REACT_FRONTEND_SRC -ErrorAction SilentlyContinue
            Remove-Item Env:BACKEND_SRC -ErrorAction SilentlyContinue
        }
    }
    "status" {
        Write-ColorOutput "📊 Service status for $Environment..." "Cyan"
        $cmd = "docker compose $composeArgs $projectArg ps"
        Invoke-Expression $cmd
    }
    "logs" {
        Write-ColorOutput "📋 Logs for $Environment... (Ctrl+C to exit)" "Cyan"
        $cmd = "docker compose $composeArgs $projectArg logs -f"
        Invoke-Expression $cmd
    }
    "prune" {
        Write-ColorOutput "🧹 Pruning unused Docker resources..." "Yellow"
        docker system prune -f
        docker volume prune -f
        docker network prune -f
    }
    default {
        Write-ColorOutput "Unknown action: $Action" "Red"
        exit 1
    }
}
