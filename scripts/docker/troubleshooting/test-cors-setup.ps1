# Test script for checking cross-container communication and CORS issues
# This script helps test the interaction between your frontend and backend containers

# Stop any existing containers
Write-Host "Stopping any existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod-test.yml down --remove-orphans

# Build and start all services with the combined docker-compose file
Write-Host "Building and starting all services using the production test setup..." -ForegroundColor Green
docker-compose -f docker-compose.prod-test.yml up -d --build

# Wait for services to start
Write-Host "Waiting for services to start up..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check if containers are running
Write-Host "Checking container status..." -ForegroundColor Magenta
docker-compose -f docker-compose.prod-test.yml ps

# View backend logs to check CORS configuration
Write-Host "Checking backend logs for CORS configuration..." -ForegroundColor Blue
docker logs fastapi_rbac 2>&1 | Select-String -Pattern "CORS|Origin"

# Test internal container communication (from frontend to backend)
Write-Host "Testing internal container communication..." -ForegroundColor Cyan
docker exec react_frontend curl -v http://fastapi_rbac:8000/api/v1/health

# Display instructions for manual testing
Write-Host "Setup complete! Here's how to test:" -ForegroundColor Green
Write-Host "1. Open http://localhost in your browser to access the frontend" -ForegroundColor Yellow
Write-Host "2. Try to log in or access protected routes" -ForegroundColor Yellow
Write-Host "3. Check the browser console for any CORS errors" -ForegroundColor Yellow
Write-Host "4. To view backend logs: docker logs fastapi_rbac" -ForegroundColor Yellow
Write-Host "5. To view frontend logs: docker logs react_frontend" -ForegroundColor Yellow
Write-Host "6. To stop all services: docker-compose -f docker-compose.prod-test.yml down" -ForegroundColor Yellow
