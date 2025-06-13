# Test Script for Docker Production Setup
# This script builds and runs the production Docker containers to verify they work correctly

Write-Host "Changing to backend directory..." -ForegroundColor Green
Set-Location backend

# Stop any running containers from previous tests
Write-Host "Stopping any existing containers..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Build the production images
Write-Host "Building production Docker images..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml build --no-cache

# Start the production environment
Write-Host "Starting production environment..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml up -d

# Change to frontend directory and start the frontend container
Write-Host "Changing to frontend directory..." -ForegroundColor Green
Set-Location -Path ../react-frontend
docker-compose -f docker-compose.prod.yml up -d

# Check if containers are running
Write-Host "Checking container status..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml ps

# Wait for services to be ready
Write-Host "Waiting for services to be ready..." -ForegroundColor Green
Start-Sleep -Seconds 15

# Test backend API health endpoint
Write-Host "Testing backend API health endpoint..." -ForegroundColor Green
try {
    # Use Docker to execute curl inside the fastapi container
    $healthResult = docker exec fastapi_rbac curl -s http://localhost:8000/api/v1/health
    Write-Host "Backend health check result: $healthResult" -ForegroundColor Green
} catch {
    Write-Host "Failed to check backend health: $_" -ForegroundColor Red
}

# Test frontend availability
Write-Host "Testing frontend availability..." -ForegroundColor Green
try {
    $frontendResult = curl -s http://localhost:80
    if ($frontendResult) {
        Write-Host "Frontend is accessible" -ForegroundColor Green
    } else {
        Write-Host "Frontend may not be properly serving content" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed to access frontend: $_" -ForegroundColor Red
}

Write-Host "Production Docker environment test completed!" -ForegroundColor Green
Write-Host "To stop the containers, run: docker-compose -f docker-compose.prod.yml down" -ForegroundColor Yellow
