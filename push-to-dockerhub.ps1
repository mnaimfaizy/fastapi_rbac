# Script to build and push Docker images to DockerHub

# You need to be logged in to DockerHub:
# docker login

# Set your DockerHub username
$DOCKERHUB_USERNAME = "your-dockerhub-username"

# Set your image names and tags
$BACKEND_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-backend"
$FRONTEND_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-frontend"
$WORKER_IMAGE = "$DOCKERHUB_USERNAME/fastapi-rbac-worker"
$TAG = "latest"

# Stop any running containers
Write-Host "Stopping any running containers..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Build the production images
Write-Host "Building production Docker images..." -ForegroundColor Green
docker-compose -f docker-compose.prod.yml build

# Tag images for DockerHub
Write-Host "Tagging images for DockerHub..." -ForegroundColor Green
docker tag fastapi_rbac:prod $BACKEND_IMAGE`:$TAG
docker tag react_frontend:prod $FRONTEND_IMAGE`:$TAG
docker tag fastapi_rbac_worker:prod $WORKER_IMAGE`:$TAG

# Push images to DockerHub
Write-Host "Pushing images to DockerHub..." -ForegroundColor Green
docker push $BACKEND_IMAGE`:$TAG
docker push $FRONTEND_IMAGE`:$TAG
docker push $WORKER_IMAGE`:$TAG

Write-Host "Images have been built and pushed to DockerHub successfully!" -ForegroundColor Green
Write-Host "Your images are available at:" -ForegroundColor Green
Write-Host "- $BACKEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $FRONTEND_IMAGE`:$TAG" -ForegroundColor Green
Write-Host "- $WORKER_IMAGE`:$TAG" -ForegroundColor Green
