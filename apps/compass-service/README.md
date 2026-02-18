# Compass Service

Harvest plan management microservice for the Brinex platform.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
npm ci --legacy-peer-deps

# Start the service
npx nx serve compass-service

# Build
npx nx build compass-service
```

### Testing

```bash
# Run all tests
npx nx test compass-service

# Run tests with coverage
npx nx test compass-service --coverage

# Quick test script (Linux/Mac)
chmod +x ./run-tests.sh
./run-tests.sh all

# Quick test script (Windows)
.\run-tests.ps1 -TestType all
```

For detailed testing instructions, see [TESTING.md](./TESTING.md)

## 📋 Features

- ✅ Create, read, update, and delete harvest plans
- ✅ Filter plans by user, status, and date range
- ✅ Pagination support for large datasets
- ✅ gRPC-based communication
- ✅ MongoDB data persistence
- ✅ Kafka event streaming
- ✅ Harvest status tracking (FRESHER, MIDLEVEL, HARVESTED, DISPOSED)
- ✅ Automatic end date calculation based on plan period

## 🏗️ Architecture

### Technology Stack
- **Framework**: NestJS
- **Database**: MongoDB with Mongoose ODM
- **Communication**: gRPC (Protocol Buffers)
- **Event Streaming**: Apache Kafka
- **Testing**: Jest

### Service Structure
```
apps/compass-service/
├── src/
│   ├── app/
│   │   ├── harvest-plan/
│   │   │   ├── harvest-plan.controller.ts    # gRPC endpoints
│   │   │   ├── harvest-plan.service.ts       # Business logic
│   │   │   ├── harvest-plan.module.ts
│   │   │   ├── dtos/
│   │   │   │   └── harvest-plan.dto.ts       # Data transfer objects
│   │   │   └── schemas/
│   │   │       └── harvest-plan.schema.ts    # MongoDB schema
│   │   └── app.module.ts
│   └── main.ts
├── tests/
│   ├── unit/
│   │   ├── app.service.spec.ts               # Unit tests
│   │   ├── app.controller.spec.ts
│   │   └── harvest-plan.service.spec.ts
│   └── e2e/
│       └── app.e2e.spec.ts                   # E2E integration tests
├── .env.test                                  # Test environment config
├── .env.test.example                          # Test config template
├── TESTING.md                                 # Testing documentation
├── run-tests.sh                               # Linux/Mac test runner
└── run-tests.ps1                              # Windows test runner
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Location: `.github/workflows/compass-service-ci.yml`

**Triggers**:
- Push to `main`, `master`, or `develop`
- Pull requests
- Changes to compass-service files or proto definitions

**Pipeline Stages**:
1. **Test** - Lint, type check, unit tests, build
2. **Integration Test** - E2E tests with MongoDB and Kafka
3. **Docker Build** - Validate Docker image creation
4. **Code Quality** - Format checking and reporting

**Services Used**:
- MongoDB 7.0
- Apache Kafka 7.5.0

### Running CI/CD Locally

```bash
# Full CI/CD simulation
./run-tests.sh all

# Individual stages
npx nx lint compass-service          # Linting
npx nx typecheck compass-service     # Type checking
npx nx test compass-service          # Unit tests
npx nx build compass-service         # Build

# Docker build (like in CI)
docker build -t compass-service:local \
  --build-arg SERVICE_NAME=compass-service \
  -f Dockerfile .
```

## 📊 API Endpoints (gRPC)

### HarvestPlanService

| Method | Description |
|--------|-------------|
| `CreatePlan` | Create a new harvest plan |
| `GetPlan` | Retrieve a plan by ID |
| `GetPlans` | List all plans with filters |
| `UpdatePlan` | Update an existing plan |
| `DeletePlan` | Delete a plan |

### Request/Response Examples

See proto definition: `proto/harvestPlan.proto`

## 🧪 Testing

### Test Coverage

Current coverage targets:
- Statements: 80%+
- Branches: 80%+
- Functions: 80%+
- Lines: 80%+

### Test Files

- **Unit Tests**: `tests/unit/*.spec.ts`
- **E2E Tests**: `tests/e2e/app.e2e.spec.ts`
- **Test Data**: Mocked MongoDB models

### Running Tests

```bash
# Unit tests only
npx nx test compass-service

# With coverage report
npx nx test compass-service --coverage

# Watch mode for development
npx nx test compass-service --watch

# Specific test file
npx nx test compass-service --testFile=harvest-plan.service.spec.ts
```

### Test Environment Setup

1. Copy environment template:
   ```bash
   cp .env.test.example .env.test
   ```

2. Start MongoDB:
   ```bash
   docker run -d --name compass-mongo \
     -p 27017:27017 \
     -e MONGO_INITDB_ROOT_USERNAME=root \
     -e MONGO_INITDB_ROOT_PASSWORD=testpassword \
     mongo:7.0
   ```

3. Run tests:
   ```bash
   npx nx test compass-service
   ```

For detailed testing guide, see [TESTING.md](./TESTING.md)

## 🐳 Docker

### Build Image

```bash
# Using root Dockerfile
docker build -t compass-service:latest \
  --build-arg SERVICE_NAME=compass-service \
  -f ../../Dockerfile .

# Or use Docker Compose
docker-compose build compass-service
```

### Run Container

```bash
docker run -d \
  -p 50052:50052 \
  -e MONGO_URI=mongodb://mongo:27017/compass \
  -e KAFKA_BROKER=kafka:9092 \
  -e GRPC_URL=0.0.0.0:50052 \
  compass-service:latest
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | Required |
| `GRPC_URL` | gRPC server address | `0.0.0.0:50052` |
| `KAFKA_BROKER` | Kafka broker address | `kafka:9092` |
| `NODE_ENV` | Environment (development/production/test) | `development` |

### Proto Definitions

gRPC service definitions: `proto/harvestPlan.proto`

Enums:
- `HarvestStatus`: FRESHER (0), MIDLEVEL (1), HARVESTED (2), DISPOSED (3)

## 📈 Monitoring

### Logs

```bash
# View service logs
docker logs compass-service

# Follow logs
docker logs -f compass-service

# In development
npx nx serve compass-service
```

### Health Checks

The service exposes gRPC health checks on port 50052.

## 🤝 Contributing

### Before Committing

1. Run tests: `./run-tests.sh all`
2. Check linting: `npx nx lint compass-service --fix`
3. Verify build: `npx nx build compass-service`

### Pull Request Checklist

- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Code coverage maintained or improved
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Documentation updated
- [ ] TESTING.md updated if test changes

## 📚 Documentation

- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [CI/CD Workflows](../../.github/workflows/README.md) - Pipeline documentation
- [Proto Definitions](../../proto/harvestPlan.proto) - gRPC service definitions

## 🔍 Troubleshooting

### Common Issues

**MongoDB Connection Error**
```bash
# Check MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker restart compass-mongo
```

**gRPC Port Already in Use**
```bash
# Find process using port 50052
lsof -i :50052  # Linux/Mac
netstat -ano | findstr :50052  # Windows

# Kill the process or change GRPC_URL
```

**Test Failures**
```bash
# Clear Jest cache
npx nx reset

# Reinstall dependencies
rm -rf node_modules
npm ci --legacy-peer-deps
```

## 📝 License

MIT

## 👥 Team

Brinex Development Team

## 🔗 Related Services

- API Gateway - REST API interface
- Auth Service - Authentication and authorization
- User Service - User management
