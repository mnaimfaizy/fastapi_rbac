#!/usr/bin/env pwsh
# Comprehensive Test Environment Testing and Validation Script
# This script provides all testing functionality for the FastAPI RBAC environment

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("test", "dev", "prod")]
    [string]$Environment = "test",

    [Parameter(Mandatory=$false)]
    [ValidateSet("connectivity", "validation", "comprehensive", "all")]
    [string]$TestType = "all",

    [switch]$BuildImages,
    [switch]$StartEnvironment,
    [switch]$StopEnvironment,
    [switch]$CleanupAfter,
    [switch]$ShowDetails,
    [switch]$SkipFrontend,
    [switch]$FixIssues,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Color functions for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    switch ($Color) {
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Blue" { Write-Host $Message -ForegroundColor Blue }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        "Magenta" { Write-Host $Message -ForegroundColor Magenta }
        default { Write-Host $Message }
    }
}

function Write-TestResult {
    param([string]$Test, [bool]$Passed, [string]$Details = "")
    $status = if ($Passed) { "✅" } else { "❌" }
    $color = if ($Passed) { "Green" } else { "Red" }

    Write-ColorOutput "$status $Test" $color
    if ($Details -and $Verbose) {
        Write-ColorOutput "   Details: $Details" "Gray"
    }
}

function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Description,
        [int]$TimeoutSeconds = 10,
        [string]$ExpectedContent = $null
    )

    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec $TimeoutSeconds

        if ($ExpectedContent) {
            $contentMatch = $response -match $ExpectedContent
            Write-TestResult "$Description" $contentMatch "Response contains expected content"
            return $contentMatch
        } else {
            Write-TestResult "$Description" $true "HTTP 200 OK"
            return $true
        }
    } catch {
        Write-TestResult "$Description" $false $_.Exception.Message
        return $false
    }
}

function Test-DatabaseConnection {
    param([string]$Environment)

    $containerName = "fastapi_rbac_db_$Environment"

    try {
        $result = docker exec -e PGPASSWORD=postgres $containerName psql -U postgres -d "fastapi_rbac_$Environment" -c "SELECT 1;" -t 2>$null

        if ($result -match "1") {
            Write-TestResult "Database Connection ($Environment)" $true
            return $true
        } else {
            Write-TestResult "Database Connection ($Environment)" $false "No response from database"
            return $false
        }
    } catch {
        Write-TestResult "Database Connection ($Environment)" $false $_.Exception.Message
        return $false
    }
}

function Test-RedisConnection {
    param([string]$Environment)

    $containerName = "fastapi_rbac_redis_$Environment"

    try {
        $result = docker exec $containerName redis-cli ping 2>$null
        $success = $result -eq "PONG"
        Write-TestResult "Redis Connection ($Environment)" $success
        return $success
    } catch {
        Write-TestResult "Redis Connection ($Environment)" $false $_.Exception.Message
        return $false
    }
}

function Test-ContainerHealth {
    param([string]$Environment)

    Write-ColorOutput "`n🐳 Testing Container Health ($Environment environment)" "Cyan"

    $containers = docker ps --filter "name=_$Environment" --format "{{.Names}}\t{{.Status}}" 2>$null

    if (-not $containers) {
        Write-TestResult "Container Detection" $false "No containers found for $Environment environment"
        return $false
    }

    $allHealthy = $true

    foreach ($line in $containers) {
        if ($line) {
            $parts = $line -split "`t"
            $name = $parts[0]
            $status = $parts[1]

            $isHealthy = $status -match "Up.*healthy|Up \d+.*(?!unhealthy)"
            $isRunning = $status -match "Up"

            if ($isHealthy) {
                Write-TestResult "$name" $true "Healthy"
            } elseif ($isRunning) {
                Write-TestResult "$name" $true "Running (no health check)"
            } else {
                Write-TestResult "$name" $false $status
                $allHealthy = $false
            }
        }
    }

    return $allHealthy
}

function Test-ServiceConnectivity {
    param([string]$Environment)

    Write-ColorOutput "`n🌐 Testing Service Connectivity ($Environment environment)" "Cyan"

    $ports = @{
        "test" = @{
            "Frontend" = "3001"
            "Backend" = "8002"
            "MailHog" = "8027"
            "PgAdmin" = "8082"
            "Flower" = "5556"
        }
        "dev" = @{
            "Frontend" = "3000"
            "Backend" = "8000"
            "MailHog" = "8025"
            "PgAdmin" = "8080"
            "Flower" = "5555"
        }
        "prod" = @{
            "Frontend" = "3002"
            "Backend" = "8001"
            "MailHog" = "8026"
            "PgAdmin" = "8081"
            "Flower" = "5557"
        }
    }

    $envPorts = $ports[$Environment]
    $allConnected = $true

    # Test Frontend
    if (-not $SkipFrontend) {
        $frontendOk = Test-HttpEndpoint "http://localhost:$($envPorts.Frontend)" "Frontend Service"
        $allConnected = $allConnected -and $frontendOk
    }

    # Test Backend API
    $backendOk = Test-HttpEndpoint "http://localhost:$($envPorts.Backend)/api/v1/health/" "Backend API Health"
    $allConnected = $allConnected -and $backendOk

    # Test API Documentation
    $docsOk = Test-HttpEndpoint "http://localhost:$($envPorts.Backend)/docs" "API Documentation"
    $allConnected = $allConnected -and $docsOk

    # Test MailHog
    $mailhogOk = Test-HttpEndpoint "http://localhost:$($envPorts.MailHog)" "MailHog Service"
    $allConnected = $allConnected -and $mailhogOk

    # Test Database
    $dbOk = Test-DatabaseConnection $Environment
    $allConnected = $allConnected -and $dbOk

    # Test Redis
    $redisOk = Test-RedisConnection $Environment
    $allConnected = $allConnected -and $redisOk

    return $allConnected
}

function Test-CORS {
    param([string]$Environment)

    Write-ColorOutput "`n🔗 Testing CORS Configuration ($Environment environment)" "Cyan"

    $ports = @{
        "test" = @{ "Frontend" = "3001"; "Backend" = "8002" }
        "dev" = @{ "Frontend" = "3000"; "Backend" = "8000" }
        "prod" = @{ "Frontend" = "3002"; "Backend" = "8001" }
    }

    $envPorts = $ports[$Environment]

    try {
        $headers = @{
            'Origin' = "http://localhost:$($envPorts.Frontend)"
            'Access-Control-Request-Method' = 'GET'
        }

        $response = Invoke-WebRequest -Uri "http://localhost:$($envPorts.Backend)/api/v1/health/" -Method OPTIONS -Headers $headers -TimeoutSec 5
        $corsHeader = $response.Headers.'Access-Control-Allow-Origin'

        $corsOk = $corsHeader -contains '*' -or $corsHeader -contains "http://localhost:$($envPorts.Frontend)"
        Write-TestResult "CORS Configuration" $corsOk "Allow-Origin: $corsHeader"
        return $corsOk
    } catch {
        Write-TestResult "CORS Configuration" $false $_.Exception.Message
        return $false
    }
}

function Test-Authentication {
    param([string]$Environment)

    Write-ColorOutput "`n🔐 Testing Authentication System ($Environment environment)" "Cyan"

    $ports = @{
        "test" = "8002"
        "dev" = "8000"
        "prod" = "8001"
    }

    $port = $ports[$Environment]

    try {
        # Test protected endpoint (should return 401)
        $authTest = Invoke-RestMethod -Uri "http://localhost:$port/api/v1/users/" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-TestResult "Authentication Protection" $false "Protected endpoint accessible without auth"
        return $false
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-TestResult "Authentication Protection" $true "401 Unauthorized as expected"
            return $true
        } else {
            Write-TestResult "Authentication Protection" $false "Unexpected response: $($_.Exception.Response.StatusCode)"
            return $false
        }
    }
}

function Test-DatabaseData {
    param([string]$Environment)

    Write-ColorOutput "`n🗄️ Testing Database Data ($Environment environment)" "Cyan"

    $containerName = "fastapi_rbac_db_$Environment"
    $dbName = "fastapi_rbac_$Environment"

    try {
        # Test users
        $userCount = docker exec -e PGPASSWORD=postgres $containerName psql -U postgres -d $dbName -c 'SELECT count(*) FROM "User";' -t 2>$null
        $userCount = $userCount.Trim()
        $usersOk = [int]$userCount -gt 0
        Write-TestResult "Database Users" $usersOk "$userCount users found"

        # Test roles
        $roleCount = docker exec -e PGPASSWORD=postgres $containerName psql -U postgres -d $dbName -c 'SELECT count(*) FROM "Role";' -t 2>$null
        $roleCount = $roleCount.Trim()
        $rolesOk = [int]$roleCount -gt 0
        Write-TestResult "Database Roles" $rolesOk "$roleCount roles found"

        # Test permissions
        $permCount = docker exec -e PGPASSWORD=postgres $containerName psql -U postgres -d $dbName -c 'SELECT count(*) FROM "Permission";' -t 2>$null
        $permCount = $permCount.Trim()
        $permsOk = [int]$permCount -gt 0
        Write-TestResult "Database Permissions" $permsOk "$permCount permissions found"

        return $usersOk -and $rolesOk -and $permsOk

    } catch {
        Write-TestResult "Database Data Check" $false $_.Exception.Message
        return $false
    }
}

function Invoke-ConnectivityTest {
    param([string]$Environment)

    Write-ColorOutput "🧪 Running Connectivity Tests for $Environment Environment" "Magenta"
    Write-ColorOutput "========================================================" "Magenta"

    $results = @{}

    $results.Containers = Test-ContainerHealth $Environment
    $results.Services = Test-ServiceConnectivity $Environment
    $results.CORS = Test-CORS $Environment
    $results.Auth = Test-Authentication $Environment

    return $results
}

function Invoke-ValidationTest {
    param([string]$Environment)

    Write-ColorOutput "🔍 Running Validation Tests for $Environment Environment" "Magenta"
    Write-ColorOutput "=======================================================" "Magenta"

    $results = @{}

    $results.Containers = Test-ContainerHealth $Environment
    $results.Database = Test-DatabaseData $Environment

    return $results
}

function Invoke-ComprehensiveTest {
    param([string]$Environment)

    Write-ColorOutput "🎯 Running Comprehensive Tests for $Environment Environment" "Magenta"
    Write-ColorOutput "==========================================================" "Magenta"

    $results = @{}

    $results.Containers = Test-ContainerHealth $Environment
    $results.Services = Test-ServiceConnectivity $Environment
    $results.CORS = Test-CORS $Environment
    $results.Auth = Test-Authentication $Environment
    $results.Database = Test-DatabaseData $Environment

    return $results
}

function Show-TestSummary {
    param([hashtable]$Results, [string]$Environment, [string]$TestType)

    Write-ColorOutput "`n📊 Test Summary - $Environment Environment ($TestType)" "Cyan"
    Write-ColorOutput "================================================" "Cyan"

    $passed = 0
    $total = 0
      foreach ($test in $Results.Keys) {
        $total++
        if ($Results[$test]) {
            $passed++
            Write-ColorOutput "✅ ${test}: PASSED" "Green"
        } else {
            Write-ColorOutput "❌ ${test}: FAILED" "Red"
        }
    }

    $percentage = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 1) } else { 0 }

    Write-ColorOutput "`n🎯 Overall Result: $passed/$total tests passed ($percentage%)" $(if ($passed -eq $total) { "Green" } else { "Yellow" })

    if ($passed -eq $total) {
        Write-ColorOutput "🎉 All tests passed! Environment is ready for use." "Green"
    } else {
        Write-ColorOutput "⚠️  Some tests failed. Check the details above." "Yellow"
        Write-ColorOutput "💡 Use -Verbose for more detailed information." "Cyan"
    }
}

# Main execution
# Check for help request
if ($Help) {
    Write-ColorOutput "🧪 Environment Testing Suite - Help" "Cyan"
    Write-ColorOutput "====================================" "Cyan"
    Write-ColorOutput "`nThis script provides comprehensive testing for FastAPI RBAC environments.`n" "White"

    Write-ColorOutput "📋 Parameters:" "Yellow"
    Write-ColorOutput "  -Environment     : Target environment (test, dev, prod)" "White"
    Write-ColorOutput "  -TestType        : Type of tests to run (connectivity, validation, comprehensive, all)" "White"
    Write-ColorOutput "  -BuildImages     : Build Docker images before testing" "White"
    Write-ColorOutput "  -StartEnvironment: Start environment before testing" "White"
    Write-ColorOutput "  -StopEnvironment : Stop environment after testing" "White"
    Write-ColorOutput "  -CleanupAfter    : Cleanup containers after testing" "White"
    Write-ColorOutput "  -ShowDetails     : Show detailed test output" "White"
    Write-ColorOutput "  -SkipFrontend    : Skip frontend-related tests" "White"
    Write-ColorOutput "  -FixIssues       : Attempt to fix discovered issues" "White"

    Write-ColorOutput "`n💡 Examples:" "Yellow"
    Write-ColorOutput "  .\test-environment.ps1                              # Run all tests on test environment" "White"
    Write-ColorOutput "  .\test-environment.ps1 -Environment dev             # Test dev environment" "White"
    Write-ColorOutput "  .\test-environment.ps1 -TestType connectivity       # Run only connectivity tests" "White"
    Write-ColorOutput "  .\test-environment.ps1 -StartEnvironment -CleanupAfter # Start, test, and cleanup" "White"
    Write-ColorOutput "  .\test-environment.ps1 -BuildImages -StartEnvironment  # Build and test fresh images" "White"

    Write-ColorOutput "`n🎯 Test Types:" "Yellow"
    Write-ColorOutput "  connectivity    : Test service connectivity and health" "White"
    Write-ColorOutput "  validation      : Validate configuration and setup" "White"
    Write-ColorOutput "  comprehensive   : Run all available tests" "White"
    Write-ColorOutput "  all            : Run all test types" "White"
    Write-ColorOutput "`n"
    exit 0
}

Write-ColorOutput "🚀 FastAPI RBAC Environment Testing Suite" "Blue"
Write-ColorOutput "=========================================" "Blue"
Write-ColorOutput "Environment: $Environment" "White"
Write-ColorOutput "Test Type: $TestType" "White"
Write-ColorOutput "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "Gray"
Write-ColorOutput ""

# Build images if requested
if ($BuildImages) {
    Write-ColorOutput "🔨 Building Docker images..." "Yellow"
    & "$PSScriptRoot\..\environments\build-images.ps1" -Environment $Environment
}

# Start environment if requested
if ($StartEnvironment) {
    Write-ColorOutput "🚀 Starting environment..." "Yellow"
    & "$PSScriptRoot\..\environments\manage-environments.ps1" -Environment $Environment -Action up -Detached
    Start-Sleep -Seconds 10 # Give services time to start
}

# Run tests based on type
$testResults = @{}

switch ($TestType) {
    "connectivity" {
        $testResults = Invoke-ConnectivityTest $Environment
    }
    "validation" {
        $testResults = Invoke-ValidationTest $Environment
    }
    "comprehensive" {
        $testResults = Invoke-ComprehensiveTest $Environment
    }
    "all" {
        $testResults = Invoke-ComprehensiveTest $Environment
    }
}

# Show summary
Show-TestSummary $testResults $Environment $TestType

# Cleanup if requested
if ($CleanupAfter) {
    Write-ColorOutput "`n🧹 Cleaning up environment..." "Yellow"
    & "$PSScriptRoot\..\environments\manage-environments.ps1" -Environment $Environment -Action down
}

# Exit with appropriate code
$allPassed = ($testResults.Values | Where-Object { $_ -eq $false }).Count -eq 0
exit $(if ($allPassed) { 0 } else { 1 })
