# Script to build and push Docker images to DockerHub

param(
    [Parameter(Mandatory=$false)]
    [string]$Tag,
    [switch]$Help
)

function Show-Help {
    Write-Host "`n🚀 Docker Build and Push Script" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host "`nThis script builds and pushes Docker images to DockerHub for production deployment.`n" -ForegroundColor White

    Write-Host "📋 Parameters:" -ForegroundColor Yellow
    Write-Host "  -Tag   : Specify the tag for the images (optional)" -ForegroundColor White
    Write-Host "  -Help  : Show this help message" -ForegroundColor White

    Write-Host "`n💡 Examples:" -ForegroundColor Yellow
    Write-Host "  .\build-and-push.ps1           # Use auto-detected tag (git tag or 'latest')" -ForegroundColor White
    Write-Host "  .\build-and-push.ps1 v1.2.0    # Use specific tag" -ForegroundColor White
    Write-Host "  .\build-and-push.ps1 -Tag latest # Use 'latest' tag" -ForegroundColor White

    Write-Host "`n🎯 Tag Resolution Order:" -ForegroundColor Yellow
    Write-Host "  1. IMAGE_TAG environment variable (for CI)" -ForegroundColor White
    Write-Host "  2. -Tag parameter or script argument" -ForegroundColor White
    Write-Host "  3. Latest git tag (git describe --tags --abbrev=0)" -ForegroundColor White
    Write-Host "  4. 'latest' as fallback" -ForegroundColor White

    Write-Host "`n🔧 Requirements:" -ForegroundColor Yellow
    Write-Host "  • Docker logged in to DockerHub (docker login)" -ForegroundColor White
    Write-Host "  • Production environment running (docker-compose.prod-test.yml)" -ForegroundColor White
    Write-Host "  • Git repository (for auto-tag detection)" -ForegroundColor White

    Write-Host "`n📦 Images Built:" -ForegroundColor Yellow
    Write-Host "  • mnaimfaizy/fastapi-rbac-backend" -ForegroundColor White
    Write-Host "  • mnaimfaizy/fastapi-rbac-frontend" -ForegroundColor White
    Write-Host "  • mnaimfaizy/fastapi-rbac-worker" -ForegroundColor White
    Write-Host ""
}

# Check for help request
if ($Help) {
    Show-Help
    exit 0
}

# You need to be logged in to DockerHub:
# docker login

# Set your DockerHub username
$DOCKERHUB_USERNAME = "mnaimfaizy"

# Set your image names
$BACKEND_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-backend"
$FRONTEND_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-frontend"
$WORKER_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-worker"

# Determine the tag
# 1. Use IMAGE_TAG environment variable if set (e.g., by CI)
# 2. Else, use the -Tag parameter if provided
# 3. Else, use the first script argument if provided (for backwards compatibility)
# 4. Else, try to get the latest Git tag
# 5. Else, default to "latest"
if ($env:IMAGE_TAG) {
  $TAG = $env:IMAGE_TAG
  Write-Host "Using IMAGE_TAG environment variable: $TAG" -ForegroundColor Cyan
} elseif ($Tag) {
  $TAG = $Tag
  Write-Host "Using -Tag parameter: $TAG" -ForegroundColor Cyan
} elseif ($args.Count -gt 0) {
  $TAG = $args[0]
  Write-Host "Using script argument for tag: $TAG" -ForegroundColor Cyan
} else {
  # Try to get git tag
  $GitTag = try {
    git describe --tags --abbrev=0 2>$null
  } catch {
    $null
  }

  if ($GitTag -and $LASTEXITCODE -eq 0) {
    $TAG = $GitTag.Trim() # Trim potential whitespace
    Write-Host "Using Git tag: $TAG" -ForegroundColor Cyan
  } else {
    $TAG = "latest"
    Write-Host "Defaulting to tag: $TAG" -ForegroundColor Yellow
  }
}

Write-Host "Final tag to be used: $TAG" -ForegroundColor Green

# Ensure we're in the project root directory
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location -Path $ProjectRoot
Write-Host "Working from project root: $((Get-Location).Path)" -ForegroundColor Cyan

# Verify required files exist
if (-not (Test-Path "backend\docker-compose.prod.yml")) {
    Write-Error "backend\docker-compose.prod.yml not found"
    exit 1
}

if (-not (Test-Path "react-frontend\docker-compose.prod.yml")) {
    Write-Error "react-frontend\docker-compose.prod.yml not found"
    exit 1
}

if (-not (Test-Path "react-frontend\Dockerfile.prod")) {
    Write-Error "react-frontend\Dockerfile.prod not found"
    exit 1
}

if (-not (Test-Path "react-frontend\.env.production")) {
    Write-Warning "react-frontend\.env.production not found - creating from example"
    if (Test-Path "react-frontend\.env.example") {
        Copy-Item "react-frontend\.env.example" "react-frontend\.env.production"
    } else {
        Write-Error "react-frontend\.env.example not found - cannot create production env file"
        exit 1
    }
}

# Stop any running containers (optional, only if needed)
Write-Host "Stopping any running production test containers..." -ForegroundColor Green
docker-compose -f docker-compose.prod-test.yml down --remove-orphans 2>$null

# Build the production images directly from their respective compose files
Write-Host "Building backend production image..." -ForegroundColor Green
docker-compose -f backend\docker-compose.prod.yml build fastapi_rbac
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build backend image"
    exit 1
}

Write-Host "Building frontend production image..." -ForegroundColor Green
# Build directly with docker build to avoid depends_on issues
Set-Location -Path "react-frontend"
docker build -f Dockerfile.prod -t react_frontend:prod .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build React Frontend image"
    Set-Location -Path ".."
    exit 1
}
Set-Location -Path ".."

Write-Host "Building worker production image..." -ForegroundColor Green
docker-compose -f backend\docker-compose.prod.yml build fastapi_rbac_worker
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build worker image"
    exit 1
}

Write-Host "All production images built successfully!" -ForegroundColor Green

# Tag images for DockerHub
Write-Host "Tagging images for DockerHub with tag $TAG..." -ForegroundColor Green
docker tag fastapi_rbac:prod "$BACKEND_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to tag backend image"
    exit 1
}

docker tag react_frontend:prod "$FRONTEND_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to tag frontend image"
    exit 1
}

docker tag fastapi_rbac_worker:prod "$WORKER_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to tag worker image"
    exit 1
}

# Push images to DockerHub
Write-Host "Pushing images to DockerHub with tag $TAG..." -ForegroundColor Green

Write-Host "Pushing backend image..." -ForegroundColor Yellow
docker push "$BACKEND_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push backend image to DockerHub"
    exit 1
}

Write-Host "Pushing frontend image..." -ForegroundColor Yellow
docker push "$FRONTEND_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push frontend image to DockerHub"
    exit 1
}

Write-Host "Pushing worker image..." -ForegroundColor Yellow
docker push "$WORKER_IMAGE`:$TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push worker image to DockerHub"
    exit 1
}

Write-Host "Images have been built and pushed to DockerHub successfully!" -ForegroundColor Green
Write-Host "Your images are available at:" -ForegroundColor Green
Write-Host "- $BACKEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $FRONTEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $WORKER_IMAGE`:$TAG" -ForegroundColor Green
