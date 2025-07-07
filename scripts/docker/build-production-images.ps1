#!/usr/bin/env pwsh
# Build Production Images Script for FastAPI RBAC
# This script builds all Docker images for the production environment

param(
    [switch]$Verbose,
    [switch]$NoCache,
    [switch]$CleanFirst,
    [switch]$Push,
    [string]$Registry = "",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

# Color functions for output
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    if ($Color -eq "Green") { Write-Host $Message -ForegroundColor Green }
    elseif ($Color -eq "Yellow") { Write-Host $Message -ForegroundColor Yellow }
    elseif ($Color -eq "Red") { Write-Host $Message -ForegroundColor Red }
    elseif ($Color -eq "Blue") { Write-Host $Message -ForegroundColor Blue }
    else { Write-Host $Message }
}

function Push-DockerImage {
    param([string]$ImageName)

    Write-ColorOutput "Pushing image: $ImageName" "Blue"

    try {
        docker push $ImageName
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Successfully pushed: $ImageName" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Failed to push: $ImageName" "Red"
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Exception while pushing: $ImageName" "Red"
        Write-ColorOutput "Error: $_" "Red"
        return $false
    }
}

# Main build process
Write-ColorOutput "=== FastAPI RBAC Production Image Builder ===" "Blue"
Write-ColorOutput "" "White"

# Validate we're in the correct directory
if (-not (Test-Path "backend" -PathType Container) -or -not (Test-Path "react-frontend" -PathType Container)) {
    Write-ColorOutput "❌ Error: Must run from project root directory containing 'backend' and 'react-frontend' folders" "Red"
    exit 1
}

# Refactored: Use modular compose files and ensure network for production

# Compose files and network for production
$composeFiles = @("backend/docker-compose.prod.yml", "react-frontend/docker-compose.prod.yml")
$networkName = "fastapi_rbac_prod_network"
$projectName = "fastapi_rbac_production"
$composeArgs = ($composeFiles | ForEach-Object { "-f $_" }) -join " "
$projectArg = "-p $projectName"

# Ensure the external network exists
if (-not (docker network ls --format '{{.Name}}' | Select-String -Pattern "^$networkName$")) {
    Write-ColorOutput "Creating external Docker network: $networkName" "Green"
    docker network create $networkName | Out-Null
}

if ($CleanFirst) {
    Write-ColorOutput "Cleaning up existing production images..." "Yellow"
    $prodImages = @("fastapi_rbac:prod", "fastapi_rbac_worker:prod", "react_frontend:prod")
    foreach ($image in $prodImages) {
        docker image rm $image -f 2>$null
    }
    Write-ColorOutput "✅ Cleanup completed" "Green"
    Write-ColorOutput "" "White"
}

# Set build context environment variables
$env:REACT_FRONTEND_SRC = "../react-frontend"
$env:BACKEND_SRC = "../backend"

# Build images using docker compose (modular, both backend and frontend)
$buildCmd = "docker compose $composeArgs $projectArg build"
if ($NoCache) { $buildCmd += " --no-cache" }
if ($Verbose) { Write-ColorOutput "Executing: $buildCmd" "Yellow" }
Invoke-Expression $buildCmd

# After build, define builtImages and allBuildsSucceeded for tagging/pushing
$builtImages = @("fastapi_rbac:prod", "fastapi_rbac_worker:prod", "react_frontend:prod")
$allBuildsSucceeded = $true

# Unset build context environment variables
Remove-Item Env:REACT_FRONTEND_SRC -ErrorAction SilentlyContinue
Remove-Item Env:BACKEND_SRC -ErrorAction SilentlyContinue

# Tag with prod-test for production testing environment
Write-ColorOutput "Tagging images for production testing (prod-test)..." "Blue"
foreach ($imageName in $builtImages) {
    $prodTestTag = $imageName -replace ":prod", ":prod-test"
    docker tag $imageName $prodTestTag
    Write-ColorOutput "Tagged: $imageName -> $prodTestTag" "Green"
}
Write-ColorOutput "" "White"

# Tag with custom tag if specified
if ($Tag -ne "latest" -and $Tag -ne "prod") {
    Write-ColorOutput "Tagging images with custom tag: $Tag" "Blue"
    foreach ($imageName in $builtImages) {
        $newTag = $imageName -replace ":prod", ":$Tag"
        docker tag $imageName $newTag
        Write-ColorOutput "Tagged: $imageName -> $newTag" "Green"
    }
}

# Push images if requested
if ($Push -and $allBuildsSucceeded) {
    Write-ColorOutput "Pushing images to registry..." "Blue"

    foreach ($imageName in $builtImages) {
        $pushImageName = $imageName
        if ($Registry) {
            $pushImageName = "$Registry/$imageName"
            docker tag $imageName $pushImageName
            Write-ColorOutput "Tagged for registry: $imageName -> $pushImageName" "Green"
        }

        if (-not (Push-DockerImage -ImageName $pushImageName)) {
            $allBuildsSucceeded = $false
        }
    }
}

# Final result
Write-ColorOutput "" "White"
if ($allBuildsSucceeded) {
    Write-ColorOutput "🎉 All production images built successfully!" "Green"
    Write-ColorOutput "" "White"
    Write-ColorOutput "Built images:" "Blue"
    foreach ($imageName in $builtImages) {
        $imageInfo = docker images $imageName --format "{{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | Select-Object -First 1
        Write-ColorOutput "  ✅ $imageInfo" "Green"
    }
    Write-ColorOutput "" "White"
    Write-ColorOutput "Production images are ready for deployment!" "Green"
    Write-ColorOutput "" "White"
    Write-ColorOutput "Next steps:" "Blue"
    Write-ColorOutput "  1. Test images with: .\\docker-env.ps1 -Environment prod -Action up" "Yellow"
    Write-ColorOutput "  2. Deploy to production environment" "Yellow"
    Write-ColorOutput "  3. Monitor application health and logs" "Yellow"
} else {
    Write-ColorOutput "❌ Some image builds failed. Please check the errors above." "Red"
    exit 1
}

# Show final image sizes
Write-ColorOutput "" "White"
Write-ColorOutput "Production image sizes:" "Blue"
docker images | Select-String "prod" | ForEach-Object { Write-ColorOutput "  $_" "White" }
