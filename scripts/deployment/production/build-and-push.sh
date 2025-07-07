#!/bin/bash
# Script to build and push Docker images to DockerHub for Linux/CI environments

# Ignore orphaned resources to avoid network conflicts in CI
env | grep COMPOSE_IGNORE_ORPHANS || export COMPOSE_IGNORE_ORPHANS=True

set +e  # Disable exit on error for cleanup
# Stop any running containers and networks (do not fail if not found)
echo "Stopping any running containers..."
(docker network rm fastapi_rbac_prod_test_network 2>/dev/null || true)
docker compose -f docker-compose.prod-test.yml down --remove-orphans || true
set -e  # Re-enable exit on error after cleanup

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

# Build backend image
echo "Building backend production image..."
docker compose -f backend/docker-compose.prod.yml build fastapi_rbac_prod
if [ $? -ne 0 ]; then
  echo "Failed to build backend image" >&2
  exit 1
fi

# Build frontend image
echo "Building frontend production image..."
docker build -f react-frontend/Dockerfile.prod -t react_frontend:prod react-frontend
if [ $? -ne 0 ]; then
  echo "Failed to build frontend image" >&2
  exit 1
fi

# Build worker image
echo "Building worker production image..."
docker compose -f backend/docker-compose.prod.yml build fastapi_rbac_worker_prod
if [ $? -ne 0 ]; then
  echo "Failed to build worker image" >&2
  exit 1
fi

echo "All production images built successfully!"

# Tag and push backend image
echo "Tagging and pushing backend image..."
docker tag fastapi_rbac:prod "${BACKEND_IMAGE}:${TAG}"
docker push "${BACKEND_IMAGE}:${TAG}"

# Tag and push frontend image
echo "Tagging and pushing frontend image..."
docker tag react_frontend:prod "${FRONTEND_IMAGE}:${TAG}"
docker push "${FRONTEND_IMAGE}:${TAG}"

# Tag and push worker image
echo "Tagging and pushing worker image..."
docker tag fastapi_rbac_worker_prod fastapi_rbac_worker:prod 2>/dev/null || true
docker tag fastapi_rbac_worker:prod "${WORKER_IMAGE}:${TAG}"
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
