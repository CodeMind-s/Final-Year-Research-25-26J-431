# Vision Service — CI/CD Pipeline & Test Suite

## Overview

The vision-service now has a comprehensive test suite and CI/CD pipeline matching the patterns established by compass-service and user-service.

## Test Structure

```
apps/vision-service/
├── tests/
│   ├── unit/
│   │   ├── helpers/
│   │   │   ├── mock-model.helper.ts    # Reusable Mongoose mock factory
│   │   │   └── test-data.helper.ts     # Shared test fixtures
│   │   ├── roi/
│   │   │   └── roi.service.spec.ts
│   │   ├── inference/
│   │   │   ├── postprocessing.service.spec.ts
│   │   │   ├── preprocessing.service.spec.ts
│   │   │   ├── whiteness.service.spec.ts
│   │   │   └── inference.service.spec.ts
│   │   ├── detection/
│   │   │   ├── detection.service.spec.ts
│   │   │   └── detection.controller.spec.ts
│   │   ├── batch/
│   │   │   ├── batch.service.spec.ts
│   │   │   └── batch.controller.spec.ts
│   │   ├── statistics/
│   │   │   ├── statistics.service.spec.ts
│   │   │   └── statistics.controller.spec.ts
│   │   └── health/
│   │       └── health.controller.spec.ts
│   └── e2e/
│       └── vision.e2e.spec.ts
├── .env.test                           # Test MongoDB URI (Atlas)
├── .env.test.example                   # Template for local setup
└── jest.config.js                      # Modified — roots, testMatch, coverage
```

## Running Tests

### Unit Tests (no external dependencies)

```bash
# Via Jest directly
npx jest --config apps/vision-service/jest.config.js

# Via Nx
npx nx test vision-service

# With coverage
npx jest --config apps/vision-service/jest.config.js --coverage
```

### E2E Tests (requires MongoDB)

```bash
# Uses .env.test (Atlas) by default
npx jest --config apps/vision-service/jest.config.js --testPathPatterns=e2e

# With custom MongoDB URI
MONGO_URI=mongodb://localhost:27017/vision-test npx jest --config apps/vision-service/jest.config.js --testPathPatterns=e2e
```

### Run specific test file

```bash
npx jest --config apps/vision-service/jest.config.js --testPathPatterns=roi.service
```

## CI Pipeline

**File**: `.github/workflows/vision-service-ci.yml`

### Triggers

- Push to `master` or `develop` branches when vision-service files change
- Pull requests touching vision-service files
- Manual dispatch

### Jobs

1. **test** — Lint (non-blocking) + Jest unit tests
   - E2E tests are skipped in CI unless `MONGO_URI` secret is set
2. **build** (depends on test) — `npx nx build vision-service`

### Path Filters

- `apps/vision-service/**`
- `apps/api-gateway/src/app/vision-service/**`
- `proto/vision.proto`
- `packages/**`, `types/**`
- `.github/workflows/vision-service-ci.yml`

## Test Categories

### Pure Logic (no mocks)

- **ROI Service** — Default ROI, inside/outside checks, filtering, stats, validation
- **Postprocessing Service** — YOLO output parsing, confidence filtering, NMS, coordinate normalization

### Sharp Mocked

- **Preprocessing Service** — Tensor size, dimensions, normalization, CHW format
- **Whiteness Service** — Per-box whiteness, quality scores, aggregate stats

### ONNX Mocked

- **Inference Service** — Model loading, warmup, inference pipeline, error handling

### Mongoose Mocked

- **Detection Service** — CRUD, pagination, filtering, session stats increment
- **Batch Service** — Create/end lifecycle, snapshot updates, trends
- **Statistics Service** — Summary, hourly/daily aggregation, trend periods

### Controller Tests

- All controllers verified for correct delegation to services and response formatting

### E2E (real MongoDB)

- Session lifecycle (create → get → end)
- Health endpoint with mocked model status

## Mock Patterns

### Mongoose Model Mock (`createMockModel()`)

Returns a jest mock function with all Mongoose static methods (`find`, `findById`, `findByIdAndUpdate`, etc.) pre-configured with chainable query support (`.skip().limit().sort().exec()`).

### Sharp Mock

Module-level `jest.mock('sharp')` with chainable `.resize().removeAlpha().raw().toBuffer()`.

### ONNX Runtime Mock

Module-level `jest.mock('onnxruntime-node')` with `InferenceSession.create` and `Tensor` constructor mocked.

## Configuration Changes

### jest.config.js

- Added `rootDir`, `roots: ['<rootDir>/tests']`
- Added `testMatch` for `tests/**/*.spec.ts` and `tests/**/*.test.ts`
- Added `testPathIgnorePatterns` to skip E2E in CI without `MONGO_URI`
- Added `collectCoverageFrom` targeting `src/**/*.ts`

### tsconfig.spec.json

- Added `tests/**/*.spec.ts`, `tests/**/*.test.ts`, `tests/**/*.d.ts` to `include` array

---

## Performance Testing (k6)

### Overview

Beyond the Jest-based microbenchmarks (preprocessing, postprocessing, inference latency), the vision service has HTTP/WebSocket load testing via **k6**.

### Test Structure

```
apps/vision-service/tests/performance/
├── vision-performance.spec.ts          # Jest microbenchmarks (existing)
└── k6/
    ├── config.js                       # Shared config, load profiles, thresholds
    ├── rest-endpoints.js               # REST API load test (health, detections, batches, stats)
    ├── websocket-frames.js             # WebSocket frame processing load test
    └── health-soak.js                  # Soak test (sustained load, leak detection)
```

### Prerequisites

```bash
# k6 - load testing
# Windows: choco install k6  |  macOS: brew install k6  |  Linux: see k6.io docs
```

### k6 Load Tests

#### Load Profiles

| Profile | Description | VUs | Duration |
|---------|-------------|-----|----------|
| `smoke` | Minimal validation | 1 VU | 30s |
| `average` | Typical production load | 5 VUs | ~2min |
| `stress` | Peak/overload simulation | 10-50 VUs | ~3.5min |
| `spike` | Sudden traffic burst | 2-50 VUs | ~1.5min |
| `soak` | Sustained load (leak detection) | 3 VUs | ~12min |

#### Running k6 Tests

```bash
# REST endpoint smoke test
k6 run apps/vision-service/tests/performance/k6/rest-endpoints.js

# REST with specific load profile
k6 run apps/vision-service/tests/performance/k6/rest-endpoints.js \
  --env LOAD_PROFILE=average \
  --env AUTH_TOKEN=<your-jwt-token>

# REST stress test
k6 run apps/vision-service/tests/performance/k6/rest-endpoints.js \
  --env LOAD_PROFILE=stress

# WebSocket frame processing test
k6 run apps/vision-service/tests/performance/k6/websocket-frames.js \
  --env LOAD_PROFILE=smoke \
  --env FRAMES_PER_SESSION=30 \
  --env FRAME_INTERVAL_MS=200

# Soak test (long-running, detects memory leaks)
k6 run apps/vision-service/tests/performance/k6/health-soak.js

# Export JSON results
k6 run apps/vision-service/tests/performance/k6/rest-endpoints.js \
  --summary-export results.json
```

#### k6 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3400/api/v1` | API Gateway base URL |
| `WS_URL` | `ws://localhost:3400` | WebSocket base URL |
| `AUTH_TOKEN` | (empty) | JWT Bearer token for authenticated endpoints |
| `LOAD_PROFILE` | `smoke` | Load profile: smoke, average, stress, spike |
| `FRAMES_PER_SESSION` | `30` | Frames per WebSocket session |
| `FRAME_INTERVAL_MS` | `200` | Delay between frames (ms) |

#### k6 Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `vision_health_duration` | p95 < 200ms | Health endpoint latency |
| `vision_detections_duration` | p95 < 1000ms | Detections query latency |
| `vision_batches_duration` | p95 < 1000ms | Batches query latency |
| `vision_stats_duration` | p95 < 1500ms | Statistics aggregation latency |
| `ws_frame_roundtrip` | p95 < 2000ms | WebSocket frame round-trip |
| `ws_connection_time` | p95 < 3000ms | WebSocket connection establishment |
| `vision_errors` | rate < 10% | Overall error rate |

#### REST Endpoints Tested

| Endpoint | Method | Auth | Notes |
|----------|--------|------|-------|
| `/vision/health` | GET | Public | Service health + model status |
| `/vision/detections` | GET | Lab (Plan 2) | Paginated detection results |
| `/vision/batches` | GET | Lab (Plan 2) | Batch listing with filters |
| `/vision/statistics/summary` | GET | Lab (Plan 2) | Aggregate statistics |
| `/vision/statistics/hourly` | GET | Lab (Plan 2) | Hourly breakdown |
| `/vision/statistics/daily` | GET | Lab (Plan 2) | Daily breakdown |
| `/vision/statistics/trends` | GET | Lab (Plan 2) | Purity trend analysis |

#### WebSocket Events Tested

| Event | Direction | Description |
|-------|-----------|-------------|
| `start_stream` | Client -> Server | Initialize detection session |
| `start_batch` | Client -> Server | Start a new batch in session |
| `frame` | Client -> Server | Send base64 image for inference |
| `detection_result` | Server -> Client | Detection + purity results |
| `end_batch` | Client -> Server | Finalize batch |
| `stop_stream` | Client -> Server | End session |

### CI Integration

The `performance` job in `.github/workflows/vision-service-ci.yml`:

- **Trigger**: Manual dispatch (`workflow_dispatch`) or commits containing `[perf]` in the message
- **Runs**: k6 smoke test against REST endpoints
- **Artifacts**: k6 JSON results uploaded with 14-day retention
- **Does NOT** run automatically on every PR (performance tests require running services)

### Output Files

All performance test output goes to `apps/vision-service/test-output/performance/`:

```
test-output/performance/
├── performance-report-*.pdf          # Jest microbenchmark PDF reports
├── k6-rest-*.json                    # k6 REST endpoint results
├── k6-websocket-*.json               # k6 WebSocket results
└── k6-soak-*.json                    # k6 soak test results
```
