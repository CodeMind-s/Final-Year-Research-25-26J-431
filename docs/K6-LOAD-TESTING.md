# K6 Load Testing Commands

All commands should be run from the **repository root** (`Final-Year-Research-25-26J-431/`).

## Prerequisites

1. **Install k6**: https://grafana.com/docs/k6/latest/set-up/install-k6/
2. **Start the backend services** (API Gateway + required microservices):
   ```bash
   docker-compose up -d
   npx nx serve api-gateway
   npx nx serve user-service
   npx nx serve crystallization-service
   npx nx serve compass-service
   npx nx serve waste-valorization-service
   ```
3. **Obtain a JWT token** by logging in via the auth API, then export it:
   ```bash
   export AUTH_TOKEN="your-jwt-token-here"
   ```

---

## Environment Variables

| Variable             | Description                                                 | Default                        |
| -------------------- | ----------------------------------------------------------- | ------------------------------ |
| `AUTH_TOKEN`         | JWT Bearer token for authenticated endpoints                | _(empty)_                      |
| `API_BASE_URL`       | API Gateway base URL                                        | `http://localhost:3400/api/v1` |
| `LOAD_PROFILE`       | Load profile: `smoke`, `average`, `stress`                  | `smoke`                        |
| `TEST_EMAIL`         | Real user email (user-service)                              | `test@example.com`             |
| `TEST_USER_ID`       | Real MongoDB user ID (user-service)                         | `675945c5d1234567890abcde`     |
| `TEST_DATE`          | Real measurement date (crystallization-service)             | `2025-01-15`                   |
| `TEST_PRODUCTION_ID` | Real salt production ID (crystallization-service)           | `675945c5d1234567890abcde`     |
| `TEST_PLAN_ID`       | Real harvest plan ID (compass-service)                      | `675945c5d1234567890abcde`     |
| `TEST_DEAL_ID`       | Real deal ID (compass-service)                              | `675945c5d1234567890abcde`     |
| `TEST_OFFER_ID`      | Real distributor offer ID (compass-service)                 | `675945c5d1234567890abcde`     |
| `TEST_JOB_ID`        | Real waste valorization job ID (waste-valorization-service) | `675945c5d1234567890abcde`     |

---

## 1. User Service

### Smoke Test (1 VU, 30s)

```bash
k6 run -e AUTH_TOKEN=$AUTH_TOKEN apps/user-service/tests/performance/k6/rest-endpoints.js
```

### Smoke Test with Real Data

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e TEST_EMAIL="admin@brinex.com" \
  -e TEST_USER_ID="6759a1b2c3d4e5f678901234" \
  apps/user-service/tests/performance/k6/rest-endpoints.js
```

### Average Load Test (ramp to 5 VUs)

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=average \
  apps/user-service/tests/performance/k6/rest-endpoints.js
```

### Stress Test (ramp to 15 VUs)

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=stress \
  apps/user-service/tests/performance/k6/rest-endpoints.js
```

---

## 2. Crystallization Service

### Smoke Test

```bash
k6 run -e AUTH_TOKEN=$AUTH_TOKEN apps/crystallization-service/tests/performance/k6/rest-endpoints.js
```

### Smoke Test with Real Data

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e TEST_DATE="2025-03-01" \
  -e TEST_PRODUCTION_ID="6759a1b2c3d4e5f678901234" \
  apps/crystallization-service/tests/performance/k6/rest-endpoints.js
```

### Average Load Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=average \
  apps/crystallization-service/tests/performance/k6/rest-endpoints.js
```

### Stress Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=stress \
  apps/crystallization-service/tests/performance/k6/rest-endpoints.js
```

---

## 3. Compass Service

### Smoke Test

```bash
k6 run -e AUTH_TOKEN=$AUTH_TOKEN apps/compass-service/tests/performance/k6/rest-endpoints.js
```

### Smoke Test with Real Data

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e TEST_PLAN_ID="6759a1b2c3d4e5f678901234" \
  -e TEST_DEAL_ID="6759a1b2c3d4e5f678905678" \
  -e TEST_OFFER_ID="6759a1b2c3d4e5f678909012" \
  apps/compass-service/tests/performance/k6/rest-endpoints.js
```

### Average Load Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=average \
  apps/compass-service/tests/performance/k6/rest-endpoints.js
```

### Stress Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=stress \
  apps/compass-service/tests/performance/k6/rest-endpoints.js
```

---

## 4. Waste Valorization Service

### Smoke Test

```bash
k6 run -e AUTH_TOKEN=$AUTH_TOKEN apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

### Smoke Test with Real Data

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e TEST_JOB_ID="6759a1b2c3d4e5f678901234" \
  apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

### Average Load Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=average \
  apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

### Stress Test

```bash
k6 run \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=stress \
  apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

---

## Run All Services (Smoke)

```bash
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM apps/user-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM apps/crystallization-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM apps/compass-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTlmZWFiODg2OTQwN2MxY2UxYjkyMzgiLCJlbWFpbCI6InBwc0BnbWFpbC5jb20iLCJyb2xlIjoiU0FMVFNPQ0lFVFkiLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyOTAwMTU2LCJleHAiOjE3NzM1MDQ5NTZ9.l6sbtLYkdPfIwtOuyHyC4XJ833_UN7fP-y34DXxggCY apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

## Run All Services (Average Load)

```bash
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=average apps/user-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=average apps/crystallization-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=average apps/compass-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTlmZWFiODg2OTQwN2MxY2UxYjkyMzgiLCJlbWFpbCI6InBwc0BnbWFpbC5jb20iLCJyb2xlIjoiU0FMVFNPQ0lFVFkiLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyOTAwMTU2LCJleHAiOjE3NzM1MDQ5NTZ9.l6sbtLYkdPfIwtOuyHyC4XJ833_UN7fP-y34DXxggCY -e LOAD_PROFILE=average apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

## Run All Services (Stress)

```bash
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=stress apps/user-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=stress apps/crystallization-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTRiOWE5Y2YxMDZkNzcyZjFhYjFjYzQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyODg1OTE0LCJleHAiOjE3NzM0OTA3MTR9.AEjFp4IRYyJ3Cl9S7KjXC1M5kriUomFj4OpjXu6wKhM -e LOAD_PROFILE=stress apps/compass-service/tests/performance/k6/rest-endpoints.js && \
./k6.exe run -e AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTlmZWFiODg2OTQwN2MxY2UxYjkyMzgiLCJlbWFpbCI6InBwc0BnbWFpbC5jb20iLCJyb2xlIjoiU0FMVFNPQ0lFVFkiLCJwbGFuIjoicHJvIiwicGxhbkluZGV4IjoxLCJpc1RyaWFsQWN0aXZlIjpmYWxzZSwiaWF0IjoxNzcyOTAwMTU2LCJleHAiOjE3NzM1MDQ5NTZ9.l6sbtLYkdPfIwtOuyHyC4XJ833_UN7fP-y34DXxggCY -e LOAD_PROFILE=stress apps/waste-valorization-service/tests/performance/k6/rest-endpoints.js
```

---

## Load Profiles Reference

| Profile   | Description             | VUs            | Duration |
| --------- | ----------------------- | -------------- | -------- |
| `smoke`   | Minimal sanity check    | 1 VU           | 30s      |
| `average` | Typical production load | Ramp to 5 VUs  | ~2m      |
| `stress`  | Beyond normal capacity  | Ramp to 15 VUs | ~3.5m    |

---

## Reports

HTML and JSON reports are automatically generated in each service's output directory:

```
apps/user-service/test-output/performance/
apps/crystallization-service/test-output/performance/
apps/compass-service/test-output/performance/
apps/waste-valorization-service/test-output/performance/
```

Report filenames follow the pattern: `k6-rest-<profile>-<timestamp>.html` and `.json`

---

## Custom API Base URL

To run against a different environment (e.g., staging):

```bash
k6 run \
  -e API_BASE_URL="https://staging.example.com/api/v1" \
  -e AUTH_TOKEN=$AUTH_TOKEN \
  -e LOAD_PROFILE=average \
  apps/user-service/tests/performance/k6/rest-endpoints.js
```
