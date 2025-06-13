#!/usr/bin/env pwsh
# Docker Environment Management Script for FastAPI RBAC
# This script helps manage different Docker environments with proper separation

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "test", "prod-test", "prod")]
    [string]$Environment,
      [Parameter(Mandatory=$true)]
    [ValidateSet("up", "down", "restart", "logs", "status", "clean", "build")]
    [string]$Action,
      [switch]$Detached,
    [switch]$Build,
    [switch]$VerboseOutput
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    if ($Color -eq "Green") { Write-Host $Message -ForegroundColor Green }
    elseif ($Color -eq "Yellow") { Write-Host $Message -ForegroundColor Yellow }
    elseif ($Color -eq "Red") { Write-Host $Message -ForegroundColor Red }
    elseif ($Color -eq "Blue") { Write-Host $Message -ForegroundColor Blue }
    else { Write-Host $Message }
}

# Environment configuration
$environments = @{
    "dev" = @{
        "compose_files" = @("docker-compose.yml")
        "network" = "fastapi_rbac_dev_network"
        "description" = "Development Environment (Hot-reload, Debug mode)"
        "ports" = @{
            "backend" = "8000"
            "frontend" = "3000"
            "db" = "5433"
            "redis" = "6379"
            "pgadmin" = "8080"
            "mailhog" = "8025"
            "flower" = "5555"
        }
    }
    "test" = @{
        "compose_files" = @("docker-compose.test.yml")
        "network" = "fastapi_rbac_test_network"
        "description" = "Testing Environment (CI/CD, Integration tests)"
        "ports" = @{
            "backend" = "8002"
            "frontend" = "3001"
            "db" = "5435"
            "redis" = "6381"
            "mailhog" = "8027"
            "flower" = "5556"
        }
    }
    "prod-test" = @{
        "compose_files" = @("docker-compose.prod-test.yml")
        "network" = "fastapi_rbac_prod_test_network"
        "description" = "Production Testing Environment (Production-like settings)"
        "ports" = @{
            "backend" = "8001"
            "frontend" = "81"
            "db" = "5434"
            "redis" = "6380"
            "pgadmin" = "8081"
            "mailhog" = "8026"
        }
    }
    "prod" = @{
        "compose_files" = @("backend/docker-compose.prod.yml", "react-frontend/docker-compose.prod.yml")
        "network" = "fastapi_rbac_network"
        "description" = "Production Environment (Secure, Optimized)"
        "ports" = @{
            "backend" = "8000"
            "frontend" = "80"
            "db" = "5432"
            "redis" = "6379"
            "pgadmin" = "5050"
        }
    }
}

# Get environment configuration
$envConfig = $environments[$Environment]
if (-not $envConfig) {
    Write-ColorOutput "Invalid environment: $Environment" "Red"
    exit 1
}

Write-ColorOutput "=== FastAPI RBAC Environment Manager ===" "Blue"
Write-ColorOutput "Environment: $Environment" "Green"
Write-ColorOutput "Description: $($envConfig.description)" "Yellow"
Write-ColorOutput "Action: $Action" "Green"
Write-ColorOutput "" "White"

# Build docker-compose command
$composeFiles = $envConfig.compose_files | ForEach-Object { "-f", $_ }
$composeCommand = @("docker-compose") + $composeFiles

function Invoke-DockerCompose {
    param([string[]]$Arguments)
        $fullCommand = $composeCommand + $Arguments
    if ($VerboseOutput) {
        Write-ColorOutput "Executing: $($fullCommand -join ' ')" "Blue"
    }
    & $fullCommand[0] $fullCommand[1..($fullCommand.Length-1)]
}

# Create network if it doesn't exist
function Ensure-Network {
    $networkName = $envConfig.network
    $networkExists = docker network ls --format "{{.Name}}" | Where-Object { $_ -eq $networkName }
    if (-not $networkExists) {
        Write-ColorOutput "Creating network: $networkName" "Yellow"
        docker network create $networkName
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "Failed to create network: $networkName" "Red"
            exit 1
        }
    } else {
        Write-ColorOutput "Network exists: $networkName" "Green"
    }
}

# Display port information
function Show-PortInfo {
    Write-ColorOutput "Port mappings for $Environment environment:" "Blue"
    foreach ($service in $envConfig.ports.Keys) {
        $port = $envConfig.ports[$service]
        Write-ColorOutput "  $service`: localhost:$port" "White"
    }
    Write-ColorOutput "" "White"
}

# Execute the requested action
switch ($Action) {
    "up" {
        Ensure-Network
        Show-PortInfo

        $upArgs = @("up")
        if ($Detached) { $upArgs += "--detach" }
        if ($Build) { $upArgs += "--build" }

        Write-ColorOutput "Starting $Environment environment..." "Green"
        Invoke-DockerCompose $upArgs

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Environment started successfully!" "Green"
            Write-ColorOutput "Access the application at:" "Blue"
            if ($envConfig.ports.frontend) {
                Write-ColorOutput "  Frontend: http://localhost:$($envConfig.ports.frontend)" "White"
            }
            if ($envConfig.ports.backend) {
                Write-ColorOutput "  Backend API: http://localhost:$($envConfig.ports.backend)" "White"
            }
            if ($envConfig.ports.pgadmin) {
                Write-ColorOutput "  PgAdmin: http://localhost:$($envConfig.ports.pgadmin)" "White"
            }
            if ($envConfig.ports.mailhog) {
                Write-ColorOutput "  MailHog: http://localhost:$($envConfig.ports.mailhog)" "White"
            }
            if ($envConfig.ports.flower) {
                Write-ColorOutput "  Flower: http://localhost:$($envConfig.ports.flower)" "White"
            }        } else {
            Write-ColorOutput "Failed to start environment!" "Red"
            exit 1
        }
    }

    "build" {
        Write-ColorOutput "Building $Environment environment..." "Yellow"
        Invoke-DockerCompose @("build", "--no-cache")

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Environment built successfully!" "Green"
        } else {
            Write-ColorOutput "Failed to build environment!" "Red"
            exit 1
        }
    }

    "down" {
        Write-ColorOutput "Stopping $Environment environment..." "Yellow"
        Invoke-DockerCompose @("down")

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Environment stopped successfully!" "Green"
        } else {
            Write-ColorOutput "Failed to stop environment!" "Red"
            exit 1
        }
    }

    "restart" {
        Write-ColorOutput "Restarting $Environment environment..." "Yellow"
        Invoke-DockerCompose @("restart")

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Environment restarted successfully!" "Green"
        } else {
            Write-ColorOutput "Failed to restart environment!" "Red"
            exit 1
        }
    }

    "logs" {
        $logsArgs = @("logs")
        if (-not $Detached) { $logsArgs += "-f" }

        Write-ColorOutput "Showing logs for $Environment environment..." "Blue"
        Invoke-DockerCompose $logsArgs
    }

    "status" {
        Write-ColorOutput "Status for $Environment environment:" "Blue"
        Invoke-DockerCompose @("ps")

        Write-ColorOutput "`nPort mappings:" "Blue"
        Show-PortInfo

        # Check if services are healthy
        Write-ColorOutput "Health status:" "Blue"
        $containers = docker ps --filter "network=$($envConfig.network)" --format "{{.Names}}"
        foreach ($container in $containers) {
            $health = docker inspect --format='{{.State.Health.Status}}' $container 2>$null
            if ($health) {
                $color = if ($health -eq "healthy") { "Green" } else { "Red" }
                Write-ColorOutput "  $container`: $health" $color
            } else {
                Write-ColorOutput "  $container`: running (no health check)" "Yellow"
            }
        }
    }

    "clean" {
        Write-ColorOutput "Cleaning up $Environment environment..." "Yellow"

        # Stop and remove containers
        Invoke-DockerCompose @("down", "--volumes", "--remove-orphans")

        # Remove environment-specific volumes
        $envVolumes = docker volume ls --format "{{.Name}}" | Where-Object { $_ -like "*$Environment*" -or $_ -like "*${Environment}_*" }
        if ($envVolumes) {
            Write-ColorOutput "Removing environment-specific volumes..." "Yellow"
            foreach ($volume in $envVolumes) {
                docker volume rm $volume 2>$null
                Write-ColorOutput "  Removed volume: $volume" "White"
            }
        }

        # Clean up unused images for this environment
        $envImages = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -like "*:$Environment" }
        if ($envImages) {
            Write-ColorOutput "Removing environment-specific images..." "Yellow"
            foreach ($image in $envImages) {
                docker rmi $image 2>$null
                Write-ColorOutput "  Removed image: $image" "White"
            }
        }

        Write-ColorOutput "Environment cleaned successfully!" "Green"
    }
}

Write-ColorOutput "`n=== Operation completed ===" "Blue"
