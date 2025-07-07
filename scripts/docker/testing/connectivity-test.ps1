# Test script to verify all components are working
Write-Host "=== FastAPI RBAC Test Environment Connectivity Test ===" -ForegroundColor Green

# Test 1: Frontend connectivity (with retries)
Write-Host "`n1. Testing Frontend (React)..." -ForegroundColor Yellow
$frontendOk = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        $frontendResponse = Invoke-RestMethod -Uri "http://localhost:3001" -Method GET -TimeoutSec 5 -ErrorAction Stop
        if ($frontendResponse -match "FastAPI") {
            Write-Host "✅ Frontend: Responding" -ForegroundColor Green
        } else {
            Write-Host "✅ Frontend: Responding (HTML content detected)" -ForegroundColor Green
        }
        $frontendOk = $true
        break
    } catch {
        Write-Host "Frontend not ready yet, retrying... ($($i+1)/5) - $($_.Exception.Message)" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}
if (-not $frontendOk) {
    Write-Host "❌ Frontend: Not responding after retries" -ForegroundColor Red
}

# Test 2: Backend API connectivity (with retries)
Write-Host "`n2. Testing Backend API..." -ForegroundColor Yellow
$backendOk = $false
for ($i = 0; $i -lt 5; $i++) {
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/health/" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ Backend API: $($healthResponse.status)" -ForegroundColor Green
        Write-Host "   - Environment: $($healthResponse.environment)" -ForegroundColor Cyan
        Write-Host "   - Database: $($healthResponse.database.status)" -ForegroundColor Cyan
        Write-Host "   - Redis: $($healthResponse.redis.status)" -ForegroundColor Cyan
        $backendOk = $true
        break
    } catch {
        Write-Host "Backend API not ready yet, retrying... ($($i+1)/5) - $($_.Exception.Message)" -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}
if (-not $backendOk) {
    Write-Host "❌ Backend API: Not responding after retries" -ForegroundColor Red
}

# Test 3: Database connectivity (check container running)
Write-Host "`n3. Testing Database..." -ForegroundColor Yellow
$dbContainer = "fastapi_rbac_db_test"
$dbRunning = docker ps --format '{{.Names}}' | Select-String -Pattern "^$dbContainer$"
if ($dbRunning) {
    try {
        $userCount = docker exec -e PGPASSWORD=postgres $dbContainer psql -U postgres -d fastapi_rbac_test -c 'SELECT count(*) FROM "User";' -t
        $userCount = $userCount.Trim()
        Write-Host "✅ Database: Connected - $userCount users found" -ForegroundColor Green
    } catch {
        Write-Host "❌ Database: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Database: Container not running ($dbContainer)" -ForegroundColor Red
}

# Test 4: Redis connectivity (check container running)
Write-Host "`n4. Testing Redis..." -ForegroundColor Yellow
$redisContainer = "fastapi_rbac_redis_test"
$redisRunning = docker ps --format '{{.Names}}' | Select-String -Pattern "^$redisContainer$"
if ($redisRunning) {
    try {
        $redisResponse = docker exec $redisContainer redis-cli ping
        if ($redisResponse -eq "PONG") {
            Write-Host "✅ Redis: Connected" -ForegroundColor Green
        } else {
            Write-Host "❌ Redis: Unexpected response - $redisResponse" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Redis: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Redis: Container not running ($redisContainer)" -ForegroundColor Red
}

# Test 5: MailHog connectivity
Write-Host "`n5. Testing MailHog..." -ForegroundColor Yellow
try {
    $mailhogResponse = Invoke-RestMethod -Uri "http://localhost:8027/api/v1/messages" -Method GET -TimeoutSec 5
    Write-Host "✅ MailHog: Connected - $($mailhogResponse.total) messages" -ForegroundColor Green
} catch {
    Write-Host "❌ MailHog: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Flower (Celery monitoring) connectivity
Write-Host "`n6. Testing Flower (Celery Monitor)..." -ForegroundColor Yellow
try {
    $flowerResponse = Invoke-RestMethod -Uri "http://localhost:5556/api/workers" -Method GET -TimeoutSec 5
    $workerCount = ($flowerResponse | Get-Member -MemberType NoteProperty).Count
    Write-Host "✅ Flower: Connected - $workerCount workers" -ForegroundColor Green
} catch {
    Write-Host "❌ Flower: Connection failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Frontend to Backend CORS test
Write-Host "`n7. Testing CORS Configuration..." -ForegroundColor Yellow
try {
    $headers = @{
        'Origin' = 'http://localhost:3001'
        'Access-Control-Request-Method' = 'GET'
    }
    $corsResponse = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/health/" -Method OPTIONS -Headers $headers -TimeoutSec 5
    $corsHeader = $corsResponse.Headers.'Access-Control-Allow-Origin'
    if ($corsHeader -contains '*' -or $corsHeader -contains 'http://localhost:3001') {
        Write-Host "✅ CORS: Properly configured" -ForegroundColor Green
    } else {
        Write-Host "❌ CORS: Configuration issue - Allow-Origin: $corsHeader" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ CORS: Test failed - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Authentication endpoint test
Write-Host "`n8. Testing Authentication Endpoint..." -ForegroundColor Yellow
try {
    # Try to access a protected endpoint to verify auth is working
    $authTest = Invoke-RestMethod -Uri "http://localhost:8002/api/v1/users/" -Method GET -TimeoutSec 5 -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Authentication: Working (401 Unauthorized as expected)" -ForegroundColor Green
    } else {
        Write-Host "❌ Authentication: Unexpected response - $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Green
Write-Host "All core components tested. If any issues were found above, please check the container logs." -ForegroundColor White
Write-Host "`nTo view logs for a specific service, use:" -ForegroundColor Cyan
Write-Host "  docker logs <container_name>" -ForegroundColor Gray
Write-Host "`nAvailable services:" -ForegroundColor Cyan
Write-Host "  - Frontend: react_frontend_test" -ForegroundColor Gray
Write-Host "  - Backend: fastapi_rbac_test" -ForegroundColor Gray
Write-Host "  - Database: fastapi_rbac_db_test" -ForegroundColor Gray
Write-Host "  - Redis: fastapi_rbac_redis_test" -ForegroundColor Gray
Write-Host "  - MailHog: fastapi_rbac_mailhog_test" -ForegroundColor Gray
Write-Host "  - Flower: fastapi_rbac_flower_test" -ForegroundColor Gray
Write-Host "  - Worker: fastapi_rbac_worker_test" -ForegroundColor Gray
Write-Host "  - Beat: fastapi_rbac_beat_test" -ForegroundColor Gray
