# Helper script to diagnose CORS issues in the production docker environment
param (
    [switch]$Restart = $false
)

if ($Restart) {
    # Restart containers to apply any config changes
    Write-Host "Restarting containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.prod-test.yml restart
    Start-Sleep -Seconds 5
}

# Check CORS configuration in backend logs
Write-Host "CORS Configuration in Backend:" -ForegroundColor Green
docker logs fastapi_rbac 2>&1 | Select-String -Pattern "Configuring CORS|CORS|Origin" -Context 0,1

# Test API connectivity from frontend container
Write-Host "`nTesting API connectivity from frontend container:" -ForegroundColor Green
docker exec react_frontend curl -s http://fastapi_rbac:8000/ | ConvertFrom-Json | Format-List

Write-Host "`nTesting API health endpoint from frontend container:" -ForegroundColor Green
docker exec react_frontend curl -s http://fastapi_rbac:8000/api/v1/health | ConvertFrom-Json | Format-List

# Check if VITE environment variables are set correctly in the frontend container
Write-Host "`nChecking frontend environment variables:" -ForegroundColor Green
docker exec react_frontend env | Select-String -Pattern "VITE_API"

# Provide helpful next steps
Write-Host "`nTo troubleshoot further:" -ForegroundColor Cyan
Write-Host "1. Check browser console while using the app at http://localhost" -ForegroundColor Yellow
Write-Host "2. Verify that your API calls are going to the correct URL" -ForegroundColor Yellow
Write-Host "3. Make sure both the frontend and backend containers can reach each other" -ForegroundColor Yellow
Write-Host "4. Check the network tab in browser devtools for exact CORS errors" -ForegroundColor Yellow
