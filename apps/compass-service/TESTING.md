# Compass Service - CI/CD & Testing Guide

## Overview

This document provides comprehensive information about the automated testing and CI/CD pipeline for the Compass Service.

## CI/CD Pipeline

### GitHub Actions Workflow

The Compass Service uses a multi-stage GitHub Actions workflow located at `.github/workflows/compass-service-ci.yml`.

### Pipeline Stages

#### 1. Test Stage
**Purpose**: Run comprehensive tests and quality checks

**Steps**:
- Checkout code
- Setup Node.js 20
- Install dependencies
- Lint code (`npx nx lint compass-service`)
- Type check (`npx nx typecheck compass-service`)
- Run unit tests with coverage
- Build the service
- Upload coverage and build artifacts

**Services**:
- MongoDB 7.0 (for database tests)

#### 2. Integration Test Stage
**Purpose**: Test service integration with external dependencies

**Steps**:
- Setup MongoDB and Kafka services
- Download build artifacts
- Run end-to-end tests

**Services**:
- MongoDB 7.0
- Apache Kafka 7.5.0

#### 3. Docker Build Stage
**Purpose**: Validate Docker image creation

**Steps**:
- Build Docker image with BuildKit
- Test Docker image execution
- Cache layers for faster builds

#### 4. Code Quality Stage
**Purpose**: Ensure code quality standards

**Steps**:
- Check code formatting
- Generate test reports
- Create CI/CD summary

## Running Tests Locally

### Prerequisites

```bash
# Install dependencies
npm ci --legacy-peer-deps

# Start MongoDB with Docker
docker run -d --name compass-mongo \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=testpassword \
  mongo:7.0

# Optional: Start Kafka for integration tests
docker run -d --name compass-kafka \
  -p 9092:9092 \
  -e KAFKA_BROKER_ID=1 \
  -e KAFKA_ZOOKEEPER_CONNECT=localhost:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  confluentinc/cp-kafka:7.5.0
```

### Environment Setup

Create `.env.test` file:
```bash
cp apps/compass-service/.env.test.example apps/compass-service/.env.test
```

Or manually set:
```bash
export MONGO_URI=mongodb://root:testpassword@localhost:27017/compass-test?authSource=admin
export GRPC_URL=0.0.0.0:50052
export NODE_ENV=test
```

### Test Commands

```bash
# Run all tests
npx nx test compass-service

# Run tests with coverage
npx nx test compass-service --coverage

# Run tests in watch mode
npx nx test compass-service --watch

# Run specific test file
npx nx test compass-service --testFile=harvest-plan.service.spec.ts

# Run e2e tests
npx nx test:e2e compass-service
```

### Linting & Type Checking

```bash
# Lint
npx nx lint compass-service

# Lint with auto-fix
npx nx lint compass-service --fix

# Type check
npx nx typecheck compass-service
```

### Building

```bash
# Development build
npx nx build compass-service

# Production build
npx nx build compass-service --configuration=production
```

## Test Structure

### Unit Tests

Location: `tests/unit/` directory with `.spec.ts` extension

Example:
```
apps/compass-service/tests/
├── unit/
│   ├── app.service.spec.ts
│   ├── app.controller.spec.ts
│   └── harvest-plan.service.spec.ts  ← Unit tests
└── e2e/
    └── app.e2e.spec.ts
```

**Coverage**: Unit tests for the HarvestPlanService include:
- ✅ CreatePlan - Success and error cases
- ✅ GetPlan - Retrieval and not found cases
- ✅ GetPlans - Filtering, pagination, and status filtering
- ✅ UpdatePlan - Update and non-existent cases
- ✅ DeletePlan - Delete and non-existent cases

### Integration/E2E Tests

Location: `tests/e2e/app.e2e.spec.ts`

**Coverage**: E2E tests include:
- ✅ Full CRUD operations via gRPC
- ✅ Database integration
- ✅ Filter and pagination validation
- ✅ Error handling
- ✅ Status enum validation

## Test Coverage

### Current Coverage Targets
- **Statements**: 80%+
- **Branches**: 80%+
- **Functions**: 80%+
- **Lines**: 80%+

### Viewing Coverage

```bash
# Generate coverage report
npx nx test compass-service --coverage

# View HTML report
open apps/compass-service/test-output/jest/coverage/index.html
```

## CI/CD Triggers

The pipeline runs on:

### Push Events
- Branches: `main`, `master`, `develop`
- When changes are made to:
  - `apps/compass-service/**`
  - `proto/harvestPlan.proto`
  - `package.json`
  - `package-lock.json`

### Pull Requests
- Same path restrictions as push events
- Runs on all PRs targeting main branches

## Artifacts

### Test Coverage (30-day retention)
- **Path**: `apps/compass-service/test-output/jest/coverage`
- **Contents**: HTML and JSON coverage reports
- **Access**: Download from GitHub Actions artifacts

### Build Artifacts (7-day retention)
- **Path**: `apps/compass-service/dist`
- **Contents**: Compiled production code
- **Access**: Download from GitHub Actions artifacts

## Environment Variables

### Required for Tests
```bash
MONGO_URI=mongodb://root:testpassword@localhost:27017/compass-test?authSource=admin
GRPC_URL=0.0.0.0:50052
NODE_ENV=test
```

### Optional for Integration Tests
```bash
KAFKA_BROKER=localhost:9092
JWT_SECRET=test-secret-key
API_GATEWAY_URL=http://localhost:3400
```

## Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failures

**Symptom**: Tests fail with "MongooseServerSelectionError"

**Solutions**:
```bash
# Check MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker restart compass-mongo

# Check logs
docker logs compass-mongo

# Verify connection string
echo $MONGO_URI
```

#### 2. Test Timeouts

**Symptom**: Tests timeout after 5 seconds

**Solutions**:
```bash
# Increase timeout in test file
jest.setTimeout(10000);

# Run tests with more workers
npx nx test compass-service --maxWorkers=1
```

#### 3. Lint Errors

**Symptom**: ESLint errors block pipeline

**Solutions**:
```bash
# Auto-fix linting issues
npx nx lint compass-service --fix

# Check specific file
npx eslint apps/compass-service/src/app/harvest-plan/harvest-plan.service.ts
```

#### 4. Type Errors

**Symptom**: TypeScript compilation errors

**Solutions**:
```bash
# Check for type errors
npx tsc --noEmit -p apps/compass-service/tsconfig.json

# Clear cache
rm -rf node_modules/.cache
npx nx reset
```

## Writing Tests

### Unit Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

describe('ServiceName', () => {
  let service: ServiceName;
  let model: Model<ModelName>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: getModelToken(ModelName.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add your tests here
});
```

### E2E Test Template

```typescript
describe('Feature E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should test feature', async () => {
    // Test implementation
  });
});
```

## Best Practices

### 1. Test Independence
- Each test should be self-contained
- Use `beforeEach` to reset state
- Don't rely on test execution order

### 2. Mocking
- Mock external dependencies
- Use jest mocks for services
- Don't hit real external APIs

### 3. Assertions
- Use descriptive test names
- Test both success and error cases
- Assert on specific values, not just truthiness

### 4. Performance
- Keep tests fast (< 1s per test)
- Use `--maxWorkers` for parallel execution
- Mock expensive operations

### 5. Coverage
- Aim for >80% coverage
- Focus on critical paths
- Don't write tests just for coverage

## Continuous Integration Best Practices

1. **Fast Feedback**: Pipeline should complete in < 5 minutes
2. **Fail Fast**: Run linting and type checks first
3. **Parallel Execution**: Run independent stages in parallel
4. **Caching**: Cache node_modules and build artifacts
5. **Clear Logs**: Provide meaningful error messages

## Monitoring & Alerts

### GitHub Actions Dashboard
- View workflow runs: `https://github.com/{org}/{repo}/actions`
- Filter by workflow: "Compass Service CI/CD"
- Check logs for failed runs

### Notifications
- Failed builds send email notifications
- Configure in repository settings → Notifications

## Deployment

After successful CI/CD:
1. Build artifacts are generated
2. Docker image is validated
3. Ready for deployment to staging/production

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Testing Framework](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [MongoDB Testing Guide](https://mongoosejs.com/docs/jest.html)

## Contributing

When contributing to Compass Service:
1. Write tests for new features
2. Ensure all tests pass locally
3. Maintain or improve code coverage
4. Follow coding standards (linting)
5. Update documentation as needed

## Support

For CI/CD issues:
1. Check this documentation
2. Review recent workflow runs
3. Check MongoDB/Kafka service health
4. Open an issue with logs attached
