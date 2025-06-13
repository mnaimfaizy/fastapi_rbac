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

function Build-DockerImage {
    param(
        [string]$Context,
        [string]$Dockerfile,
        [string]$ImageName,
        [string]$Target = "production",
        [hashtable]$BuildArgs = @{}
    )

    Write-ColorOutput "Building production image: $ImageName (target: $Target)" "Blue"

    $buildCommand = "docker build"

    if ($NoCache) {
        $buildCommand += " --no-cache"
    }

    if ($Target) {
        $buildCommand += " --target $Target"
    }

    $buildCommand += " -f $Dockerfile"

    foreach ($key in $BuildArgs.Keys) {
        $buildCommand += " --build-arg $key=$($BuildArgs[$key])"
    }

    $buildCommand += " -t $ImageName $Context"

    if ($Verbose) {
        Write-ColorOutput "Executing: $buildCommand" "Yellow"
    }

    try {
        Invoke-Expression $buildCommand
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ Successfully built: $ImageName" "Green"
            return $true
        } else {
            Write-ColorOutput "❌ Failed to build: $ImageName" "Red"
            return $false
        }
    } catch {
        Write-ColorOutput "❌ Exception while building: $ImageName" "Red"
        Write-ColorOutput "Error: $_" "Red"
        return $false
    }
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

if ($CleanFirst) {
    Write-ColorOutput "Cleaning up existing production images..." "Yellow"
    $prodImages = @("fastapi_rbac:prod", "fastapi_rbac_worker:prod", "react_frontend:prod")
    foreach ($image in $prodImages) {
        docker image rm $image -f 2>$null
    }
    Write-ColorOutput "✅ Cleanup completed" "Green"
    Write-ColorOutput "" "White"
}

$allBuildsSucceeded = $true
$builtImages = @()

# Define production images to build
$images = @(
    @{
        Name = "Backend API"
        Context = "backend"
        Dockerfile = "backend/Dockerfile.prod"
        ImageName = "fastapi_rbac:prod"
        Target = "production"
        BuildArgs = @{
            ENVIRONMENT = "production"
        }
    },
    @{
        Name = "Celery Worker"
        Context = "backend"
        Dockerfile = "backend/queue.dockerfile.prod"
        ImageName = "fastapi_rbac_worker:prod"
        Target = "production"
        BuildArgs = @{
            ENVIRONMENT = "production"
        }
    },
    @{
        Name = "React Frontend"
        Context = "react-frontend"
        Dockerfile = "react-frontend/Dockerfile.prod"
        ImageName = "react_frontend:prod"
        Target = "production"
        BuildArgs = @{
            NODE_ENV = "production"
        }
    }
)

# Build each image
foreach ($imageConfig in $images) {
    Write-ColorOutput "Building $($imageConfig.Name)..." "Blue"

    if (-not (Test-Path $imageConfig.Dockerfile)) {
        Write-ColorOutput "❌ Dockerfile not found: $($imageConfig.Dockerfile)" "Red"
        $allBuildsSucceeded = $false
        continue
    }

    if (Build-DockerImage -Context $imageConfig.Context -Dockerfile $imageConfig.Dockerfile -ImageName $imageConfig.ImageName -Target $imageConfig.Target -BuildArgs $imageConfig.BuildArgs) {
        $builtImages += $imageConfig.ImageName
    } else {
        $allBuildsSucceeded = $false
    }
    Write-ColorOutput "" "White"
}

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
    Write-ColorOutput "  1. Test images with: docker-compose -f backend/docker-compose.prod.yml up" "Yellow"
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
