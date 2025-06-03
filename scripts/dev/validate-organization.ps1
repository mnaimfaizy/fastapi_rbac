# Validation Script for FastAPI RBAC Project Organization
# Run this script to verify all components are working after the reorganization

param(
    [switch]$Quick,
    [switch]$Full,
    [switch]$Scripts,
    [switch]$Docker,
    [switch]$Documentation
)

Write-Host "🔍 FastAPI RBAC Project Validation" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

function Test-ScriptPaths {
    Write-Host "`n📁 Validating Script Paths..." -ForegroundColor Yellow

    $scriptTests = @(
        @{ Path = "scripts\docker\validate-docker-config.ps1"; Name = "Docker Config Validator" },
        @{ Path = "scripts\docker\test-production-setup.ps1"; Name = "Production Test Script" },
        @{ Path = "scripts\docker\diagnose-cors.ps1"; Name = "CORS Diagnostic Tool" },
        @{ Path = "scripts\deployment\push-to-dockerhub.ps1"; Name = "DockerHub Push Script" },
        @{ Path = "scripts\database\create-dbs.sql"; Name = "Database Creation Script" }
    )

    $allValid = $true
    foreach ($test in $scriptTests) {
        if (Test-Path $test.Path) {
            Write-Host "  ✅ $($test.Name): $($test.Path)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($test.Name): $($test.Path) - NOT FOUND" -ForegroundColor Red
            $allValid = $false
        }
    }

    return $allValid
}

function Test-DockerConfiguration {
    Write-Host "`n🐳 Validating Docker Configuration..." -ForegroundColor Yellow

    try {
        # Test docker-compose configuration
        $composeTest = docker-compose config 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ docker-compose.yml configuration is valid" -ForegroundColor Green
        } else {
            Write-Host "  ❌ docker-compose.yml configuration error:" -ForegroundColor Red
            Write-Host "     $composeTest" -ForegroundColor Red
            return $false
        }

        # Test if database script is accessible
        if (Test-Path "scripts\database\create-dbs.sql") {
            Write-Host "  ✅ Database initialization script is accessible" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Database initialization script not found" -ForegroundColor Red
            return $false
        }

        return $true
    }
    catch {
        Write-Host "  ❌ Docker validation failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-Documentation {
    Write-Host "`n📚 Validating Documentation Structure..." -ForegroundColor Yellow

    $docTests = @(
        @{ Path = "docs\README.md"; Name = "Documentation Index" },
        @{ Path = "docs\getting-started\GETTING_STARTED.md"; Name = "Getting Started Guide" },
        @{ Path = "docs\development\DEVELOPER_SETUP.md"; Name = "Developer Setup Guide" },
        @{ Path = "docs\deployment\PRODUCTION_SETUP.md"; Name = "Production Setup Guide" },
        @{ Path = "docs\troubleshooting\CORS_TROUBLESHOOTING.md"; Name = "CORS Troubleshooting" },
        @{ Path = "scripts\README.md"; Name = "Scripts Documentation" }
    )

    $allValid = $true
    foreach ($test in $docTests) {
        if (Test-Path $test.Path) {
            Write-Host "  ✅ $($test.Name): $($test.Path)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($test.Name): $($test.Path) - NOT FOUND" -ForegroundColor Red
            $allValid = $false
        }
    }

    return $allValid
}

function Test-GitHubWorkflows {
    Write-Host "`n🔄 Validating GitHub Workflows..." -ForegroundColor Yellow

    $workflowTests = @(
        @{ Path = ".github\workflows\docker-publish.yml"; Name = "Docker Publish Workflow" },
        @{ Path = ".github\workflows\backend-ci.yml"; Name = "Backend CI Workflow" },
        @{ Path = ".github\workflows\react-frontend-ci.yml"; Name = "Frontend CI Workflow" }
    )

    $allValid = $true
    foreach ($test in $workflowTests) {
        if (Test-Path $test.Path) {
            Write-Host "  ✅ $($test.Name): $($test.Path)" -ForegroundColor Green

            # Check if docker-publish.yml references the correct script path
            if ($test.Path -eq ".github\workflows\docker-publish.yml") {
                $content = Get-Content $test.Path -Raw
                if ($content -match "scripts/deployment/push-to-dockerhub.sh") {
                    Write-Host "    ✅ Script path correctly updated" -ForegroundColor Green
                } else {
                    Write-Host "    ❌ Script path not updated to new location" -ForegroundColor Red
                    $allValid = $false
                }
            }
        } else {
            Write-Host "  ❌ $($test.Name): $($test.Path) - NOT FOUND" -ForegroundColor Red
            $allValid = $false
        }
    }

    return $allValid
}

function Show-Summary {
    param($results)

    Write-Host "`n📊 Validation Summary" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan

    $allPassed = $true
    foreach ($result in $results.GetEnumerator()) {
        $status = if ($result.Value) { "✅ PASS" } else { "❌ FAIL" }
        $color = if ($result.Value) { "Green" } else { "Red" }
        Write-Host "  $($result.Key): $status" -ForegroundColor $color

        if (-not $result.Value) {
            $allPassed = $false
        }
    }

    Write-Host ""
    if ($allPassed) {
        Write-Host "🎉 All validations passed! The project reorganization is successful." -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  • Start development: docker-compose up -d" -ForegroundColor White
        Write-Host "  • Read documentation: docs\getting-started\GETTING_STARTED.md" -ForegroundColor White
        Write-Host "  • Use scripts: scripts\README.md" -ForegroundColor White
    } else {
        Write-Host "⚠️  Some validations failed. Please check the issues above." -ForegroundColor Red
        Write-Host ""
        Write-Host "For help:" -ForegroundColor Yellow
        Write-Host "  • Check docs\troubleshooting\ for common issues" -ForegroundColor White
        Write-Host "  • Verify all files were moved correctly" -ForegroundColor White
        Write-Host "  • Run git status to see any uncommitted changes" -ForegroundColor White
    }
}

# Main execution
Write-Host "Running validation for the reorganized FastAPI RBAC project...`n"

$results = @{}

# Determine what to test based on parameters
if ($Scripts -or $Full -or (-not $Quick -and -not $Scripts -and -not $Docker -and -not $Documentation)) {
    $results["Script Paths"] = Test-ScriptPaths
}

if ($Docker -or $Full -or (-not $Quick -and -not $Scripts -and -not $Docker -and -not $Documentation)) {
    $results["Docker Configuration"] = Test-DockerConfiguration
}

if ($Documentation -or $Full -or (-not $Quick -and -not $Scripts -and -not $Docker -and -not $Documentation)) {
    $results["Documentation"] = Test-Documentation
}

if ($Full -or (-not $Quick -and -not $Scripts -and -not $Docker -and -not $Documentation)) {
    $results["GitHub Workflows"] = Test-GitHubWorkflows
}

if ($Quick) {
    Write-Host "🏃‍♂️ Quick validation (essential paths only)..." -ForegroundColor Yellow
    $results["Essential Scripts"] = (Test-Path "scripts\README.md") -and (Test-Path "docs\getting-started\GETTING_STARTED.md")
    $results["Docker Compose"] = Test-Path "docker-compose.yml"
}

Show-Summary $results

Write-Host "`n💡 Tips:" -ForegroundColor Cyan
Write-Host "  • Use -Quick for basic validation" -ForegroundColor White
Write-Host "  • Use -Full for comprehensive validation" -ForegroundColor White
Write-Host "  • Use specific flags (-Scripts, -Docker, -Documentation) for targeted tests" -ForegroundColor White
