#!/bin/bash
# Test Script for Docker Production Setup
# This script builds and runs the production Docker containers to verify they work correctly

# Stop any running containers from previous tests
echo -e "\033[32mStopping any existing containers...\033[0m"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Build the production images
echo -e "\033[32mBuilding production Docker images...\033[0m"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start the production environment
echo -e "\033[32mStarting production environment...\033[0m"
docker-compose -f docker-compose.prod.yml up -d

# Check if containers are running
echo -e "\033[32mChecking container status...\033[0m"
docker-compose -f docker-compose.prod.yml ps

# Wait for services to be ready
echo -e "\033[32mWaiting for services to be ready...\033[0m"
sleep 15

# Test backend API health endpoint
echo -e "\033[32mTesting backend API health endpoint...\033[0m"
health_result=$(docker exec fastapi_rbac curl -s http://localhost:8000/api/v1/health || echo "Failed")
if [ "$health_result" != "Failed" ]; then
    echo -e "\033[32mBackend health check result: $health_result\033[0m"
else
    echo -e "\033[31mFailed to check backend health\033[0m"
fi

# Test frontend availability
echo -e "\033[32mTesting frontend availability...\033[0m"
frontend_result=$(curl -s http://localhost:80 || echo "Failed")
if [ "$frontend_result" != "Failed" ]; then
    echo -e "\033[32mFrontend is accessible\033[0m"
else
    echo -e "\033[33mFrontend may not be properly serving content\033[0m"
fi

echo -e "\033[32mProduction Docker environment test completed!\033[0m"
echo -e "\033[33mTo stop the containers, run: docker-compose -f docker-compose.prod.yml down\033[0m"
