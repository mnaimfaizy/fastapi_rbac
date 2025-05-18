# Script to build and push Docker images to DockerHub

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
# 2. Else, use the first script argument if provided
# 3. Else, try to get the latest Git tag
# 4. Else, default to "latest"
if ($env:IMAGE_TAG) {
  $TAG = $env:IMAGE_TAG
  Write-Host "Using IMAGE_TAG environment variable: $TAG" -ForegroundColor Cyan
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

# Stop any running containers
Write-Host "Stopping any running containers..." -ForegroundColor Green
docker-compose -f docker-compose.prod-test.yml down --remove-orphans

# Build the production images
Write-Host "Building production Docker images..." -ForegroundColor Green
docker-compose -f docker-compose.prod-test.yml build

# Tag images for DockerHub
Write-Host "Tagging images for DockerHub with tag $TAG..." -ForegroundColor Green
docker tag fastapi_rbac:prod "$BACKEND_IMAGE`:$TAG"
docker tag react_frontend:prod "$FRONTEND_IMAGE`:$TAG"
docker tag fastapi_rbac_worker:prod "$WORKER_IMAGE`:$TAG"

# Push images to DockerHub
Write-Host "Pushing images to DockerHub with tag $TAG..." -ForegroundColor Green
docker push "$BACKEND_IMAGE`:$TAG"
docker push "$FRONTEND_IMAGE`:$TAG"
docker push "$WORKER_IMAGE`:$TAG"

Write-Host "Images have been built and pushed to DockerHub successfully!" -ForegroundColor Green
Write-Host "Your images are available at:" -ForegroundColor Green
Write-Host "- $BACKEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $FRONTEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $WORKER_IMAGE`:$TAG" -ForegroundColor Green
