# Compass Service CI/CD Pipeline

This directory contains the GitHub Actions workflow for automated testing and deployment of the Compass Service.

## Workflows

### `compass-service-ci.yml`
Automated CI/CD pipeline for the Compass Service that runs on every push and pull request.

## Pipeline Stages

### 1. **Test Stage**
- Sets up MongoDB service for database tests
- Runs linting checks
- Performs type checking
- Executes unit tests with coverage
- Builds the service
- Uploads test coverage and build artifacts

**Services:**
- MongoDB 7.0 (for database operations)

**Environment Variables:**
- `MONGO_URI`: MongoDB connection string
- `GRPC_URL`: gRPC server address
- `NODE_ENV`: test

### 2. **Integration Test Stage**
- Sets up MongoDB and Kafka services
- Downloads build artifacts from test stage
- Runs end-to-end integration tests
- Tests API endpoints

**Services:**
- MongoDB 7.0
- Kafka 7.5.0 (for event streaming)

### 3. **Docker Build Stage**
- Builds Docker image for the service
- Uses BuildKit caching for faster builds
- Tests the Docker image
- Validates the containerized application

### 4. **Code Quality Stage**
- Checks code formatting
- Generates test reports
- Provides CI/CD summary

## Triggers

The pipeline triggers on:

**Push events:**
- Branches: `main`, `master`, `develop`
- Paths:
  - `apps/compass-service/**`
  - `proto/harvestPlan.proto`
  - `package.json`
  - `package-lock.json`

**Pull requests:**
- Same path restrictions as push events

## Running Tests Locally

### Prerequisites
```bash
# Install dependencies
npm ci --legacy-peer-deps

# Start MongoDB (Docker)
docker run -d -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=testpassword \
  mongo:7.0
```

### Run Tests
```bash
# Lint
npx nx lint compass-service

# Type check
npx nx typecheck compass-service

# Unit tests
npx nx test compass-service

# Unit tests with coverage
npx nx test compass-service --coverage

# Build
npx nx build compass-service
```

### Environment Variables for Testing
```bash
export MONGO_URI=mongodb://root:testpassword@localhost:27017/compass-test?authSource=admin
export GRPC_URL=0.0.0.0:50052
export NODE_ENV=test
```

## Artifacts

The pipeline generates and stores the following artifacts:

1. **compass-service-coverage** (30 days retention)
   - Test coverage reports
   - Location: `apps/compass-service/test-output/jest/coverage`

2. **compass-service-build** (7 days retention)
   - Production build files
   - Location: `apps/compass-service/dist`

## Monitoring

Check the pipeline status:
1. Go to the repository's Actions tab
2. Select "Compass Service CI/CD" workflow
3. View the latest runs and their status

## Test Coverage

The pipeline enforces code quality through:
- **Unit test coverage**: Collected and uploaded as artifacts
- **Linting**: ESLint with project-specific rules
- **Type checking**: TypeScript strict mode
- **Code formatting**: Prettier (optional check)

## Troubleshooting

### MongoDB Connection Issues
If tests fail with MongoDB connection errors:
- Ensure health check passes before running tests
- Verify `MONGO_URI` environment variable is correct
- Check MongoDB service logs in GitHub Actions

### Build Failures
Common issues:
- **Missing dependencies**: Run `npm ci --legacy-peer-deps`
- **Type errors**: Check TypeScript compilation with `npx nx typecheck compass-service`
- **Lint errors**: Fix with `npx nx lint compass-service --fix`

### Test Failures
- Review test logs in GitHub Actions
- Run tests locally to reproduce
- Check test coverage reports in artifacts

## Contributing

When adding new tests:
1. Place unit tests next to the file being tested (`.spec.ts`)
2. Update test coverage thresholds if needed
3. Ensure all tests pass locally before pushing
4. Add integration tests for new API endpoints

## CI/CD Best Practices

1. **Keep tests fast**: Use mocks for external dependencies
2. **Test isolation**: Each test should be independent
3. **Clear assertions**: Use descriptive test names and expectations
4. **Mock external services**: Don't rely on external APIs in tests
5. **Clean up**: Reset mocks and test data after each test

## Contact

For issues with the CI/CD pipeline, please:
1. Check the troubleshooting section
2. Review recent workflow runs
3. Create an issue with workflow logs attached
