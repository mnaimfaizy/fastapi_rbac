#!/bin/bash
# Script to build and push Docker images to DockerHub

# You need to be logged in to DockerHub:
# docker login

# Set your DockerHub username
DOCKERHUB_USERNAME="mnaimfaizy"

# Set your image names and tags
BACKEND_IMAGE="${DOCKERHUB_USERNAME}/fastapi-rbac-backend"
FRONTEND_IMAGE="${DOCKERHUB_USERNAME}/fastapi-rbac-frontend"
WORKER_IMAGE="${DOCKERHUB_USERNAME}/fastapi-rbac-worker"

# Determine the tag
# 1. Use IMAGE_TAG environment variable if set (e.g., by CI)
# 2. Else, try to get the latest Git tag (if $1 is not set)
# 3. Else, use the first script argument if provided
# 4. Else, default to "latest"
if [ -n "$IMAGE_TAG" ]; then
  TAG="$IMAGE_TAG"
elif [ -n "$1" ]; then
  TAG="$1"
elif git describe --tags --abbrev=0 > /dev/null 2>&1; then
  TAG=$(git describe --tags --abbrev=0)
else
  TAG="latest"
fi

echo -e "\\033[33mUsing tag: ${TAG}\\033[0m"

# Stop any running containers
echo -e "\\033[32mStopping any running containers...\\033[0m"
docker compose -f docker-compose.prod.yml down --remove-orphans

# Build the production images
echo -e "\\033[32mBuilding production Docker images...\\033[0m"
docker compose -f docker-compose.prod.yml build

# Tag images for DockerHub
echo -e "\\033[32mTagging images for DockerHub with tag ${TAG}...\\033[0m"
docker tag fastapi_rbac:prod "${BACKEND_IMAGE}:${TAG}"
docker tag react_frontend:prod "${FRONTEND_IMAGE}:${TAG}"
docker tag fastapi_rbac_worker:prod "${WORKER_IMAGE}:${TAG}"

# Push images to DockerHub
echo -e "\\033[32mPushing images to DockerHub with tag ${TAG}...\\033[0m"
docker push "${BACKEND_IMAGE}:${TAG}"
docker push "${FRONTEND_IMAGE}:${TAG}"
docker push "${WORKER_IMAGE}:${TAG}"

echo -e "\\033[32mImages have been built and pushed to DockerHub successfully!\\033[0m"
echo -e "\033[32mYour images are available at:\033[0m"
echo -e "\033[32m- ${BACKEND_IMAGE}:${TAG}\033[0m"
echo -e "\033[32m- ${FRONTEND_IMAGE}:${TAG}\033[0m"
echo -e "\033[32m- ${WORKER_IMAGE}:${TAG}\033[0m"
