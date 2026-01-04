#!/bin/bash
# Script to start the E2E test environment
# This script ensures both backend and frontend are running for E2E tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting E2E Test Environment${NC}"
echo "======================================"

# Function to check if a service is healthy
check_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $service_name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done
    
    echo -e "${RED}✗ $service_name failed to start within ${max_attempts}s${NC}"
    return 1
}

# Check if backend is running
echo ""
echo "Checking backend status..."
if curl -s -f http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is already running${NC}"
else
    echo -e "${YELLOW}⚠ Backend is not running${NC}"
    echo "Please start the backend in one of the following ways:"
    echo ""
    echo "Option 1 - Docker (recommended):"
    echo "  cd ../backend && docker-compose -f docker-compose.dev.yml up -d"
    echo ""
    echo "Option 2 - Direct Python:"
    echo "  cd ../backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    echo ""
    echo "After starting the backend, run this script again."
    exit 1
fi

# Check if test users exist
echo ""
echo "Verifying test users..."
response=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@example.com", "password": "AdminPass123!"}')

if echo "$response" | grep -q "access_token"; then
    echo -e "${GREEN}✓ Test admin user exists and can login${NC}"
else
    echo -e "${YELLOW}⚠ Test admin user may not exist or credentials are incorrect${NC}"
    echo "You may need to run backend initialization:"
    echo "  cd ../backend && python app/initial_data.py"
    echo ""
    echo "Continuing anyway..."
fi

# Now ready to run tests
echo ""
echo -e "${GREEN}✅ E2E Environment is ready!${NC}"
echo "======================================"
echo ""
echo "You can now run E2E tests:"
echo "  npm run test:e2e          # Run all tests"
echo "  npm run test:e2e:ui       # Run with UI mode"
echo "  npm run test:e2e:headed   # Run in headed mode (visible browser)"
echo "  npm run test:e2e:debug    # Run in debug mode"
echo ""
