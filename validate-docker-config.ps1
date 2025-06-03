# Docker Configuration Validation Script
# Run this script to validate your production Docker setup

param(
    [switch]$Fix,
    [switch]$Validate,
    [switch]$Deploy
)

Write-Host "FastAPI RBAC Docker Configuration Validator" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Configuration validation function
function Test-DockerConfig {
    Write-Host "`n1. Validating Docker Compose configuration..." -ForegroundColor Yellow

    try {
        $configTest = docker-compose -f docker-compose.prod-test.yml config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Docker Compose configuration is valid" -ForegroundColor Green
        } else {
            Write-Host "❌ Docker Compose configuration errors:" -ForegroundColor Red
            Write-Host $configTest -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Failed to validate Docker Compose configuration" -ForegroundColor Red
        return $false
    }

    return $true
}

# Environment file validation
function Test-EnvironmentFiles {
    Write-Host "`n2. Checking environment files..." -ForegroundColor Yellow

    $envFiles = @(
        "backend\.env.production",
        "react-frontend\.env.production"
    )

    $allFilesExist = $true
    foreach ($file in $envFiles) {
        if (Test-Path $file) {
            Write-Host "✅ Found: $file" -ForegroundColor Green
        } else {
            Write-Host "❌ Missing: $file" -ForegroundColor Red
            $allFilesExist = $false
        }
    }

    return $allFilesExist
}

# Security check function
function Test-SecurityConfiguration {
    Write-Host "`n3. Checking security configuration..." -ForegroundColor Yellow

    $backendEnv = "backend\.env.production"
    $securityIssues = @()

    if (Test-Path $backendEnv) {
        $content = Get-Content $backendEnv -Raw
          # Check for default passwords (more precise patterns)
        if ($content -match "password.*=.*(^admin$|^password$|^123$|^default$|admin123|password123)") {
            $securityIssues += "Default passwords detected in $backendEnv"
        }

        # Check for localhost in CORS
        if ($content -match "BACKEND_CORS_ORIGINS.*localhost") {
            $securityIssues += "Localhost found in CORS origins (should be removed for production)"
        }

        # Check for strong secrets
        if ($content -match "SECRET_KEY.*=.*your_") {
            $securityIssues += "Default secret keys detected (need to be changed for production)"
        }
    }

    if ($securityIssues.Count -eq 0) {
        Write-Host "✅ Security configuration looks good" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⚠️  Security issues found:" -ForegroundColor Yellow
        foreach ($issue in $securityIssues) {
            Write-Host "   - $issue" -ForegroundColor Red
        }
        return $false
    }
}

# Certificate check function
function Test-Certificates {
    Write-Host "`n4. Checking TLS certificates..." -ForegroundColor Yellow

    $certFiles = @(
        "backend\certs\ca.crt",
        "backend\certs\redis.crt",
        "backend\certs\redis.key"
    )

    $allCertsExist = $true
    foreach ($cert in $certFiles) {
        if (Test-Path $cert) {
            Write-Host "✅ Found: $cert" -ForegroundColor Green
        } else {
            Write-Host "❌ Missing: $cert" -ForegroundColor Red
            $allCertsExist = $false
        }
    }

    if (-not $allCertsExist) {
        Write-Host "💡 Run backend\certs\generate-certs.ps1 to create certificates" -ForegroundColor Cyan
    }

    return $allCertsExist
}

# Main validation workflow
function Start-Validation {
    $results = @{
        DockerConfig = Test-DockerConfig
        EnvironmentFiles = Test-EnvironmentFiles
        Security = Test-SecurityConfiguration
        Certificates = Test-Certificates
    }

    Write-Host "`n===============================================" -ForegroundColor Cyan
    Write-Host "Validation Summary:" -ForegroundColor Cyan

    $allGood = $true
    foreach ($test in $results.GetEnumerator()) {
        $status = if ($test.Value) { "✅ PASS" } else { "❌ FAIL"; $allGood = $false }
        Write-Host "$($test.Key): $status" -ForegroundColor $(if ($test.Value) { "Green" } else { "Red" })
    }

    if ($allGood) {
        Write-Host "`n🎉 All validations passed! Ready for production deployment." -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Please fix the issues above before deploying to production." -ForegroundColor Yellow
        Write-Host "📖 Refer to DOCKER_SECURITY_FIXES.md and PRODUCTION_CONFIG_TEMPLATE.md for guidance." -ForegroundColor Cyan
    }

    return $allGood
}

# Quick fix function
function Start-QuickFix {
    Write-Host "🔧 Applying quick fixes..." -ForegroundColor Yellow

    # Generate certificates if missing
    if (-not (Test-Path "backend\certs\ca.crt")) {
        Write-Host "Generating TLS certificates..." -ForegroundColor Cyan
        Set-Location "backend\certs"
        .\generate-certs.ps1
        Set-Location "..\..\"
    }

    # Create environment files from examples if missing
    if (-not (Test-Path "backend\.env.production")) {
        Write-Host "Creating backend production environment file..." -ForegroundColor Cyan
        Copy-Item "backend\.env.example" "backend\.env.production"
        Write-Host "⚠️  Please edit backend\.env.production with production values!" -ForegroundColor Yellow
    }

    if (-not (Test-Path "react-frontend\.env.production")) {
        Write-Host "Creating frontend production environment file..." -ForegroundColor Cyan
        Copy-Item "react-frontend\.env.example" "react-frontend\.env.production"
    }

    Write-Host "✅ Quick fixes applied. Please run validation again." -ForegroundColor Green
}

# Deploy function
function Start-Deploy {
    Write-Host "🚀 Starting production deployment..." -ForegroundColor Green

    if (Start-Validation) {
        Write-Host "Building and starting services..." -ForegroundColor Cyan
        docker-compose -f docker-compose.prod-test.yml up --build -d

        Write-Host "Checking service health..." -ForegroundColor Cyan
        Start-Sleep 10
        docker-compose -f docker-compose.prod-test.yml ps

        Write-Host "`n🎉 Deployment completed!" -ForegroundColor Green
        Write-Host "Frontend: http://localhost" -ForegroundColor Cyan
        Write-Host "Backend API: http://localhost:8000/docs" -ForegroundColor Cyan
        Write-Host "PgAdmin: http://localhost:5050" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Validation failed. Deployment aborted." -ForegroundColor Red
    }
}

# Main script logic
if ($Fix) {
    Start-QuickFix
} elseif ($Deploy) {
    Start-Deploy
} else {
    Start-Validation
}

Write-Host "`nUsage:" -ForegroundColor Cyan
Write-Host "  .\validate-docker-config.ps1         # Validate configuration" -ForegroundColor Gray
Write-Host "  .\validate-docker-config.ps1 -Fix    # Apply quick fixes" -ForegroundColor Gray
Write-Host "  .\validate-docker-config.ps1 -Deploy # Validate and deploy" -ForegroundColor Gray
