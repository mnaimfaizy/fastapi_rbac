#!/bin/bash
# Script to build and push Docker images to DockerHub for Linux/CI environments

set -e  # Exit on any error

# You need to be logged in to DockerHub:
# docker login

# Set your DockerHub username
DOCKERHUB_USERNAME="mnaimfaizy"

# Set your image names
BACKEND_IMAGE="$DOCKERHUB_USERNAME/fastapi-rbac-backend"
FRONTEND_IMAGE="$DOCKERHUB_USERNAME/fastapi-rbac-frontend"
WORKER_IMAGE="$DOCKERHUB_USERNAME/fastapi-rbac-worker"

# Determine the tag
# 1. Use IMAGE_TAG environment variable if set (e.g., by CI)
# 2. Else, use the first script argument if provided
# 3. Else, try to get the latest Git tag
# 4. Else, default to "latest"
if [ -n "$IMAGE_TAG" ]; then
  TAG="$IMAGE_TAG"
  echo "Using IMAGE_TAG environment variable: $TAG"
elif [ $# -gt 0 ]; then
  TAG="$1"
  echo "Using script argument for tag: $TAG"
else
  # Try to get git tag
  if GIT_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
    TAG="$GIT_TAG"
    echo "Using Git tag: $TAG"
  else
    TAG="latest"
    echo "Defaulting to tag: $TAG"
  fi
fi

echo "Final tag to be used: $TAG"

# Stop any running containers
echo "Stopping any running containers..."
docker network rm fastapi_rbac_network || true
docker compose -f docker-compose.prod-test.yml down --remove-orphans || true

# Build the production images
echo "Building production Docker images..."
docker compose -f docker-compose.prod-test.yml build

# Tag and push backend image
echo "Tagging and pushing backend image..."
docker tag fastapi_rbac_backend_prod_test "${BACKEND_IMAGE}:${TAG}"
docker push "${BACKEND_IMAGE}:${TAG}"

# Tag and push frontend image
echo "Tagging and pushing frontend image..."
docker tag react_frontend_prod_test "${FRONTEND_IMAGE}:${TAG}"
docker push "${FRONTEND_IMAGE}:${TAG}"

# Tag and push worker image
echo "Tagging and pushing worker image..."
docker tag fastapi_rbac_worker_prod_test "${WORKER_IMAGE}:${TAG}"
docker push "${WORKER_IMAGE}:${TAG}"

# If tag is not latest, also tag as latest for main branch pushes
if [ "$TAG" != "latest" ] && [ "${GITHUB_REF}" = "refs/heads/main" ]; then
  echo "Also tagging as 'latest' for main branch..."

  docker tag "${BACKEND_IMAGE}:${TAG}" "${BACKEND_IMAGE}:latest"
  docker push "${BACKEND_IMAGE}:latest"

  docker tag "${FRONTEND_IMAGE}:${TAG}" "${FRONTEND_IMAGE}:latest"
  docker push "${FRONTEND_IMAGE}:latest"

  docker tag "${WORKER_IMAGE}:${TAG}" "${WORKER_IMAGE}:latest"
  docker push "${WORKER_IMAGE}:latest"
fi

echo "Docker images have been successfully built and pushed!"
echo "Backend: ${BACKEND_IMAGE}:${TAG}"
echo "Frontend: ${FRONTEND_IMAGE}:${TAG}"
echo "Worker: ${WORKER_IMAGE}:${TAG}"
