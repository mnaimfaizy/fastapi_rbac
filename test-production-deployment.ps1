# FastAPI RBAC Local Production Test Script
# This script tests the production configuration locally before deployment

Write-Host "FastAPI RBAC Production Configuration Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running or not installed" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose version | Out-Null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available" -ForegroundColor Red
    exit 1
}

Write-Host "`n1. Validating configuration..." -ForegroundColor Yellow
if (Test-Path ".\validate-docker-config.ps1") {
    $validation = & .\validate-docker-config.ps1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Configuration validation passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Configuration validation failed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  Validation script not found, skipping..." -ForegroundColor Yellow
}

Write-Host "`n2. Checking Docker Compose syntax..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.prod-test.yml config --quiet
    Write-Host "✅ Docker Compose syntax is valid" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose syntax error" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.prod-test.yml",
    "backend/docker-compose.prod.yml",
    "react-frontend/docker-compose.prod.yml",
    "backend/.env.production",
    "react-frontend/.env.production",
    "backend/certs/ca.crt",
    "backend/certs/redis.crt",
    "backend/certs/redis.key"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`nMissing files detected. Please ensure all required files are present." -ForegroundColor Red
    exit 1
}

# Offer to start services for testing
Write-Host "`n4. Production test options:" -ForegroundColor Yellow
Write-Host "   [1] Validate only (current)" -ForegroundColor Cyan
Write-Host "   [2] Start services for local testing" -ForegroundColor Cyan
Write-Host "   [3] Build images without starting" -ForegroundColor Cyan
Write-Host "   [4] Show service configuration" -ForegroundColor Cyan

$choice = Read-Host "`nSelect option (1-4, default: 1)"

switch ($choice) {
    "2" {
        Write-Host "`nStarting services for local testing..." -ForegroundColor Yellow
        Write-Host "This will:" -ForegroundColor Cyan
        Write-Host "- Build all Docker images" -ForegroundColor Cyan
        Write-Host "- Start all services" -ForegroundColor Cyan
        Write-Host "- Make services available at:" -ForegroundColor Cyan
        Write-Host "  • Frontend: http://localhost" -ForegroundColor Cyan
        Write-Host "  • API: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "  • PgAdmin: http://localhost:5050" -ForegroundColor Cyan

        $confirm = Read-Host "`nContinue? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Write-Host "`nStarting services..." -ForegroundColor Green
            docker-compose -f docker-compose.prod-test.yml up -d --build

            if ($LASTEXITCODE -eq 0) {
                Write-Host "`n✅ Services started successfully!" -ForegroundColor Green
                Write-Host "`nService Status:" -ForegroundColor Cyan
                docker-compose -f docker-compose.prod-test.yml ps

                Write-Host "`nTo view logs:" -ForegroundColor Yellow
                Write-Host "docker-compose -f docker-compose.prod-test.yml logs -f" -ForegroundColor Cyan
                Write-Host "`nTo stop services:" -ForegroundColor Yellow
                Write-Host "docker-compose -f docker-compose.prod-test.yml down" -ForegroundColor Cyan
            } else {
                Write-Host "❌ Failed to start services" -ForegroundColor Red
            }
        }
    }
    "3" {
        Write-Host "`nBuilding images..." -ForegroundColor Yellow
        docker-compose -f docker-compose.prod-test.yml build
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Images built successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to build images" -ForegroundColor Red
        }
    }
    "4" {
        Write-Host "`nService Configuration:" -ForegroundColor Yellow
        docker-compose -f docker-compose.prod-test.yml config
    }
    default {
        Write-Host "`n✅ Validation complete!" -ForegroundColor Green
    }
}

Write-Host "`n🎉 Production configuration test completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Update production domain in backend/.env.production" -ForegroundColor White
Write-Host "2. Deploy to production server" -ForegroundColor White
Write-Host "3. Configure DNS and SSL certificates" -ForegroundColor White
Write-Host "4. Set up monitoring and backups" -ForegroundColor White

Write-Host "`nFor deployment guide, see: DEPLOYMENT_READINESS_CHECKLIST.md" -ForegroundColor Yellow
