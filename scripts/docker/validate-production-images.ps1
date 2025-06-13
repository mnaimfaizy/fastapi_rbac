#!/usr/bin/env pwsh
# Production Images Validation Script
# This script validates that the production images were built correctly and can start

param(
    [switch]$Verbose,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    switch ($Color) {
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        default { Write-Host $Message }
    }
}

function Test-ImageExists {
    param([string]$ImageName)

    try {
        $result = docker images -q $ImageName 2>$null
        return ![string]::IsNullOrEmpty($result)
    } catch {
        return $false
    }
}

function Test-ImageCanRun {
    param(
        [string]$ImageName,
        [string]$ContainerName,
        [array]$Command = @(),
        [hashtable]$Environment = @{},
        [int]$TimeoutSeconds = 30
    )

    Write-ColorOutput "Testing image: $ImageName" "Blue"

    # Build docker run command
    $runArgs = @("run", "--rm", "--name", $ContainerName)

    # Add environment variables
    foreach ($key in $Environment.Keys) {
        $runArgs += "-e", "$key=$($Environment[$key])"
    }

    # Add the image name
    $runArgs += $ImageName

    # Add command if specified
    if ($Command.Count -gt 0) {
        $runArgs += $Command
    }

    if ($Verbose) {
        Write-ColorOutput "Running: docker $($runArgs -join ' ')" "Yellow"
    }

    try {
        # Start container in background for testing
        $containerId = & docker run -d --name $ContainerName @($runArgs[2..($runArgs.Length-1)])

        if ([string]::IsNullOrEmpty($containerId)) {
            Write-ColorOutput "❌ Failed to start container for $ImageName" "Red"
            return $false
        }

        # Wait a moment for container to start
        Start-Sleep -Seconds 5

        # Check if container is still running
        $status = docker ps -q --filter "id=$containerId"

        if ([string]::IsNullOrEmpty($status)) {
            # Container stopped, check logs
            Write-ColorOutput "❌ Container exited immediately for $ImageName" "Red"
            if ($Verbose) {
                $logs = docker logs $containerId 2>&1
                Write-ColorOutput "Container logs: $logs" "Red"
            }
            docker rm $containerId 2>$null
            return $false
        } else {
            Write-ColorOutput "✅ Container started successfully for $ImageName" "Green"

            # Stop and remove container unless KeepRunning is specified
            if (-not $KeepRunning) {
                docker stop $containerId >$null 2>&1
                docker rm $containerId >$null 2>&1
                Write-ColorOutput "✅ Container cleaned up" "Green"
            } else {
                Write-ColorOutput "🔄 Container left running: $containerId" "Yellow"
            }
            return $true
        }
    } catch {
        Write-ColorOutput "❌ Exception testing $ImageName : $_" "Red"
        # Clean up if container exists
        docker rm $ContainerName -f 2>$null
        return $false
    }
}

# Main validation process
Write-ColorOutput "🔍 Production Images Validation" "Cyan"
Write-ColorOutput "===============================" "Cyan"
Write-ColorOutput ""

$allTestsPassed = $true
$testResults = @()

# Define images to test
$imagesToTest = @(
    @{
        Name = "Backend API"
        Image = "fastapi_rbac:prod"
        Container = "test_fastapi_prod_validation"
        Environment = @{
            DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
            REDIS_URL = "redis://localhost:6379"
            SECRET_KEY = "test-secret-key-for-validation"
            ENVIRONMENT = "production"
        }
        Command = @("python", "-c", "print('FastAPI backend image validation - OK')")
    },
    @{
        Name = "Celery Worker"
        Image = "fastapi_rbac_worker:prod"
        Container = "test_worker_prod_validation"
        Environment = @{
            DATABASE_URL = "postgresql://user:pass@localhost:5432/db"
            REDIS_URL = "redis://localhost:6379"
            SECRET_KEY = "test-secret-key-for-validation"
            ENVIRONMENT = "production"
        }
        Command = @("python", "-c", "print('FastAPI worker image validation - OK')")
    },
    @{
        Name = "React Frontend"
        Image = "react_frontend:prod"
        Container = "test_frontend_prod_validation"
        Environment = @{
            VITE_API_BASE_URL = "http://localhost:8000"
        }
        Command = @("sh", "-c", "echo 'React frontend image validation - OK'")
    }
)

# Check if images exist first
Write-ColorOutput "🔍 Checking if production images exist..." "Blue"
foreach ($test in $imagesToTest) {
    if (Test-ImageExists -ImageName $test.Image) {
        Write-ColorOutput "✅ Image exists: $($test.Image)" "Green"
    } else {
        Write-ColorOutput "❌ Image not found: $($test.Image)" "Red"
        $allTestsPassed = $false
    }
}

Write-ColorOutput ""

if (-not $allTestsPassed) {
    Write-ColorOutput "❌ Some production images are missing. Please build them first." "Red"
    Write-ColorOutput "Run: .\scripts\docker\build-production-images.ps1" "Yellow"
    exit 1
}

# Test each image
Write-ColorOutput "🧪 Testing production images..." "Blue"
foreach ($test in $imagesToTest) {
    $result = Test-ImageCanRun -ImageName $test.Image -ContainerName $test.Container -Environment $test.Environment -Command $test.Command

    $testResults += @{
        Name = $test.Name
        Image = $test.Image
        Passed = $result
    }

    if (-not $result) {
        $allTestsPassed = $false
    }

    Write-ColorOutput ""
}

# Final results
Write-ColorOutput "📊 Validation Results" "Cyan"
Write-ColorOutput "=====================" "Cyan"

foreach ($result in $testResults) {
    $status = if ($result.Passed) { "✅ PASS" } else { "❌ FAIL" }
    $color = if ($result.Passed) { "Green" } else { "Red" }
    Write-ColorOutput "  $($result.Name): $status" $color
}

Write-ColorOutput ""

if ($allTestsPassed) {
    Write-ColorOutput "🎉 All production images validated successfully!" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "📋 Image Summary:" "Blue"
    foreach ($test in $imagesToTest) {
        $imageInfo = docker images $test.Image --format "{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | Select-Object -First 1
        Write-ColorOutput "  $imageInfo" "White"
    }
    Write-ColorOutput ""
    Write-ColorOutput "✅ Production images are ready for deployment!" "Green"
    Write-ColorOutput ""
    Write-ColorOutput "Next steps:" "Blue"
    Write-ColorOutput "  1. Deploy to production environment" "Yellow"
    Write-ColorOutput "  2. Run integration tests" "Yellow"
    Write-ColorOutput "  3. Monitor application health" "Yellow"
} else {
    Write-ColorOutput "❌ Some production images failed validation!" "Red"
    Write-ColorOutput "Please check the errors above and rebuild if necessary." "Yellow"
    exit 1
}
