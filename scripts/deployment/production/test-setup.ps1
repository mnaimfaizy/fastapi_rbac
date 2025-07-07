# Test Script for Docker Production Setup
# This script builds and runs the production Docker containers to verify they work correctly

Write-Host "FastAPI RBAC Production Docker Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Ensure we're in the project root
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $projectRoot

# Check and create Docker network if needed
$networkName = "fastapi_rbac_prod_network"
$networkExists = docker network ls --format '{{.Name}}' | Select-String -Pattern "^$networkName$"
if (-not $networkExists) {
    Write-Host "Docker network '$networkName' does not exist. Creating..." -ForegroundColor Yellow
    docker network create $networkName | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker network '$networkName' created." -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create Docker network '$networkName'" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Docker network '$networkName' already exists." -ForegroundColor Green
}

# Stop any running containers from previous tests
Write-Host "Stopping any existing containers..." -ForegroundColor Green
docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml down --remove-orphans

# Build the production images
Write-Host "Building production Docker images..." -ForegroundColor Green
docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml build --no-cache

# Start the production environment
Write-Host "Starting production environment..." -ForegroundColor Green
docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml up -d

# Check if containers are running
Write-Host "Checking container status..." -ForegroundColor Green
docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml ps

# Wait for services to be ready
Write-Host "Waiting for services to be ready..." -ForegroundColor Green
Start-Sleep -Seconds 15

# Wait for backend container to be healthy
$backendContainer = "fastapi_rbac_prod"
$maxWait = 60  # seconds
$waited = 0
$healthy = $false
Write-Host "Waiting for backend container '$backendContainer' to become healthy..." -ForegroundColor Yellow
while ($waited -lt $maxWait) {
    $status = docker inspect -f '{{.State.Health.Status}}' $backendContainer 2>$null
    if ($status -eq "healthy") {
        $healthy = $true
        break
    }
    Start-Sleep -Seconds 2
    $waited += 2
}
if ($healthy) {
    Write-Host "Backend container is healthy!" -ForegroundColor Green
} else {
    Write-Host "Backend container did not become healthy after $maxWait seconds." -ForegroundColor Red
}

# Test backend API health endpoint
Write-Host "Testing backend API health endpoint..." -ForegroundColor Green
$healthResult = $null
try {
    $healthResult = docker exec $backendContainer curl -s http://localhost:8000/api/v1/health
    Write-Host "Backend health check result: $healthResult" -ForegroundColor Green
} catch {
    Write-Host "Failed to check backend health in ${backendContainer}: $_" -ForegroundColor Red
}

# Test frontend availability with retries
Write-Host "Testing frontend availability..." -ForegroundColor Green
$frontendOk = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        $frontendResult = curl -s http://localhost:80
        if ($frontendResult) {
            Write-Host "Frontend is accessible" -ForegroundColor Green
            $frontendOk = $true
            break
        } else {
            Write-Host "Frontend not ready yet, retrying... ($($i+1)/5)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Failed to access frontend (attempt $($i+1)): $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 3
}
if (-not $frontendOk) {
    Write-Host "Frontend may not be properly serving content after retries" -ForegroundColor Yellow
}

Write-Host "Production Docker environment test completed!" -ForegroundColor Green
Write-Host "To stop the containers, run:" -ForegroundColor Yellow
Write-Host "docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml down" -ForegroundColor Cyan
