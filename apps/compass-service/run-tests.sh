#!/bin/bash

# Compass Service - Local Test Runner
# This script helps developers run tests locally with the correct environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Compass Service Test Runner${NC}"
echo "================================"

# Check if MongoDB is running
check_mongodb() {
    echo -e "\n${YELLOW}Checking MongoDB...${NC}"
    if ! docker ps | grep -q mongo; then
        echo -e "${RED}❌ MongoDB is not running${NC}"
        echo -e "${YELLOW}Starting MongoDB...${NC}"
        docker run -d --name compass-mongo \
            -p 27017:27017 \
            -e MONGO_INITDB_ROOT_USERNAME=root \
            -e MONGO_INITDB_ROOT_PASSWORD=testpassword \
            mongo:7.0
        echo -e "${GREEN}✅ MongoDB started${NC}"
        sleep 5
    else
        echo -e "${GREEN}✅ MongoDB is running${NC}"
    fi
}

# Load environment variables
load_env() {
    echo -e "\n${YELLOW}Loading environment variables...${NC}"
    if [ -f "apps/compass-service/.env.test" ]; then
        export $(cat apps/compass-service/.env.test | grep -v '^#' | xargs)
        echo -e "${GREEN}✅ Environment loaded from .env.test${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.test not found, using defaults${NC}"
        export MONGO_URI="mongodb://root:testpassword@localhost:27017/compass-test?authSource=admin"
        export GRPC_URL="0.0.0.0:50052"
        export NODE_ENV="test"
    fi
}

# Run tests
run_tests() {
    local test_type=$1
    
    case $test_type in
        "unit")
            echo -e "\n${YELLOW}Running unit tests...${NC}"
            npx nx test compass-service
            ;;
        "coverage")
            echo -e "\n${YELLOW}Running tests with coverage...${NC}"
            npx nx test compass-service --coverage
            ;;
        "watch")
            echo -e "\n${YELLOW}Running tests in watch mode...${NC}"
            npx nx test compass-service --watch
            ;;
        "e2e")
            echo -e "\n${YELLOW}Running E2E tests...${NC}"
            npx nx test:e2e compass-service || echo -e "${YELLOW}⚠️  E2E tests not configured${NC}"
            ;;
        "all")
            echo -e "\n${YELLOW}Running all tests...${NC}"
            npx nx lint compass-service
            npx nx typecheck compass-service
            npx nx test compass-service --coverage
            npx nx build compass-service
            ;;
        *)
            echo -e "${RED}Unknown test type: $test_type${NC}"
            echo "Usage: ./run-tests.sh [unit|coverage|watch|e2e|all]"
            exit 1
            ;;
    esac
}

# Cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleanup (optional)${NC}"
    read -p "Do you want to stop MongoDB? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker stop compass-mongo || true
        docker rm compass-mongo || true
        echo -e "${GREEN}✅ MongoDB stopped and removed${NC}"
    fi
}

# Main execution
main() {
    local test_type=${1:-"unit"}
    
    # Check dependencies
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    if ! command -v npx &> /dev/null; then
        echo -e "${RED}❌ Node.js/npm is not installed${NC}"
        exit 1
    fi
    
    # Setup
    check_mongodb
    load_env
    
    # Run tests
    run_tests $test_type
    
    # Results
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}✅ Tests completed successfully!${NC}"
    else
        echo -e "\n${RED}❌ Tests failed!${NC}"
        exit 1
    fi
    
    # Cleanup
    cleanup
}

# Run main function
main $@
