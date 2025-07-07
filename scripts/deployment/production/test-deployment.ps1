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
$composeFiles = @(
    "backend/docker-compose.prod.yml",
    "react-frontend/docker-compose.prod.yml"
)
$syntaxOk = $true
foreach ($composeFile in $composeFiles) {
    if (Test-Path $composeFile) {
        try {
            docker-compose -f $composeFile config --quiet
            Write-Host "✅ $composeFile syntax is valid" -ForegroundColor Green
        } catch {
            Write-Host "❌ $composeFile syntax error" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            $syntaxOk = $false
        }
    } else {
        Write-Host "❌ $composeFile not found" -ForegroundColor Red
        $syntaxOk = $false
    }
}
if (-not $syntaxOk) {
    Write-Host "Docker Compose syntax validation failed." -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
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
        Write-Host "`nStarting services for local production testing (using modular compose files)..." -ForegroundColor Yellow
        Write-Host "This will:" -ForegroundColor Cyan
        Write-Host "- Build all Docker images (using backend/docker-compose.prod.yml and react-frontend/docker-compose.prod.yml)" -ForegroundColor Cyan
        Write-Host "- Start all services" -ForegroundColor Cyan
        Write-Host "- Make services available at:" -ForegroundColor Cyan
        Write-Host "  • Frontend: http://localhost" -ForegroundColor Cyan
        Write-Host "  • API: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "  • PgAdmin: http://localhost:5050" -ForegroundColor Cyan

        $confirm = Read-Host "`nContinue? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Write-Host "`nStarting services..." -ForegroundColor Green

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

            docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml up -d --build

            if ($LASTEXITCODE -eq 0) {
                Write-Host "`n✅ Services started successfully!" -ForegroundColor Green
                Write-Host "`nService Status:" -ForegroundColor Cyan
                docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml ps

                Write-Host "`nTo view logs:" -ForegroundColor Yellow
                Write-Host "docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml logs -f" -ForegroundColor Cyan
                Write-Host "`nTo stop services:" -ForegroundColor Yellow
                Write-Host "docker compose -f backend/docker-compose.prod.yml -f react-frontend/docker-compose.prod.yml down" -ForegroundColor Cyan
            } else {
                Write-Host "❌ Failed to start services" -ForegroundColor Red
            }
        }
    }
    "3" {
        Write-Host "`nBuilding images using modular compose files..." -ForegroundColor Yellow
        Write-Host "- Backend: backend/docker-compose.prod.yml (fastapi_rbac_prod)" -ForegroundColor Cyan
        Write-Host "- Frontend: react-frontend/Dockerfile.prod (react_frontend:prod)" -ForegroundColor Cyan
        Write-Host "- Worker: backend/docker-compose.prod.yml (fastapi_rbac_worker_prod)" -ForegroundColor Cyan
        docker-compose -f backend/docker-compose.prod.yml build fastapi_rbac_prod
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to build backend image" -ForegroundColor Red
            return
        }
        Set-Location -Path "react-frontend"
        docker build -f Dockerfile.prod -t react_frontend:prod .
        $frontendExit = $LASTEXITCODE
        Set-Location -Path ".."
        if ($frontendExit -ne 0) {
            Write-Host "❌ Failed to build frontend image" -ForegroundColor Red
            return
        }
        docker-compose -f backend/docker-compose.prod.yml build fastapi_rbac_worker_prod
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to build worker image" -ForegroundColor Red
            return
        }
        Write-Host "✅ Images built successfully" -ForegroundColor Green
    }
    "4" {
        Write-Host "`nService Configuration (backend and frontend):" -ForegroundColor Yellow
        Write-Host "--- backend/docker-compose.prod.yml ---" -ForegroundColor Cyan
        docker-compose -f backend/docker-compose.prod.yml config
        Write-Host "--- react-frontend/docker-compose.prod.yml ---" -ForegroundColor Cyan
        docker-compose -f react-frontend/docker-compose.prod.yml config
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
