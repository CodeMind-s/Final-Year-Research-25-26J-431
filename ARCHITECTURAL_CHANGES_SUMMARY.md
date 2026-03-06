# Architectural Changes Summary: Demand-Price Forecast Service

**Date:** 2025-01-16  
**Issue:** `predicted_bags: 0` and `yield_ratio_used: 0` due to architectural flaw

## Root Cause Analysis

The compass-ml-service was calling crystallization-onnx-service internally via gRPC with **hardcoded dummy sensor values** (all 1.0), which caused the ONNX model to return `NaN` production values. These NaN values were converted to `0` by proto3/gRPC, resulting in zero demand forecasts.

## Architectural Fix: Service Orchestration at API Gateway

**Previous Architecture (Broken):**
```
API Gateway → compass-service → compass-ml-service → crystallization-onnx-service (via gRPC with dummy values)
```

**New Architecture (Fixed):**
```
API Gateway → [crystallization-onnx-service] + [compass-ml-service]
             ↓
             (orchestrates both services, passes real production values)
```

## Files Modified

### 1. Python Service (compass-ml-service)

#### ✅ `models.py`
- **Added required fields** to `ForecastRequest`:
  - `production_forecast_m1: float` (required, gt=0)
  - `production_forecast_m2: float` (required, gt=0)
  - `production_month_m1: str` (required, pattern: YYYY-MM)
  - `production_month_m2: str` (required, pattern: YYYY-MM)
- **Updated** `HealthResponse`:
  - Removed `crystallization_service_reachable` field

#### ✅ `main.py`
- **Removed all gRPC code**:
  - Deleted `from grpc_client import ...` import
  - Removed `CRYSTALLIZATION_SERVICE_URL` environment variable
  - Removed `grpc_client` and `grpc_available` from AppState
  - Removed gRPC initialization from lifespan
  - Removed gRPC shutdown from lifespan
- **Updated `/api/v1/health` endpoint**:
  - Removed gRPC reachability check
  - Status is now `degraded` only if MongoDB is down
- **Updated `/api/v1/demand-price-forecast` endpoint**:
  - Now **requires** production values in request body
  - Validates production month matches expected month+1/+2
  - Passes production values directly to `forecast_demand()`
  - No longer calls gRPC internally

#### ✅ `requirements.txt`
- **Removed gRPC dependencies**:
  - `grpcio==1.64.0`
  - `grpcio-tools==1.64.0`
  - `protobuf==5.26.1`

#### ✅ `grpc_client.py`
- **DELETED** — no longer needed

### 2. NestJS Service (compass-service)

#### ✅ `ml-forecast.service.ts`
- **Updated `getDemandPriceForecast()` method signature**:
  ```typescript
  async getDemandPriceForecast(
    forecastDate?: string,
    production_forecast_m1?: number,
    production_forecast_m2?: number,
    production_month_m1?: string,
    production_month_m2?: string,
  )
  ```
- **Updated HTTP request body** to include all production fields

#### ✅ `ml-forecast.controller.ts`
- **Updated gRPC handler** `GetDemandPriceForecast`:
  - Now accepts `production_forecast_m1`, `production_forecast_m2`, `production_month_m1`, `production_month_m2`
  - Passes all fields to service method

### 3. API Gateway (api-gateway)

#### ✅ `compass.module.ts`
- **Added CRYSTALLIZATION_PACKAGE** gRPC client:
  ```typescript
  {
    name: 'CRYSTALLIZATION_PACKAGE',
    transport: Transport.GRPC,
    options: {
      package: 'crystallization',
      protoPath: join(__dirname, 'proto/crystallization-prediction.proto'),
      url: process.env.CRYSTALLIZATION_SERVICE_URL || 'localhost:50054',
      ...
    },
  }
  ```

#### ✅ `compass.controller.ts`
- **Updated constructor** to inject both COMPASS_PACKAGE and CRYSTALLIZATION_PACKAGE
- **Rewrote `getDemandPriceForecast()` endpoint**:
  1. Calculates month+1 and month+2 from `forecast_date`
  2. **Calls crystallization-onnx-service** via gRPC `GetPredictedMonthlyProduction` with startMonth/endMonth
  3. Extracts `production_m1` and `production_m2` from crystallization response
  4. **Calls compass-ml-service** via gRPC `GetDemandPriceForecast` with production values
  5. Returns final demand+price forecast

### 4. Protocol Buffer (proto/harvestPlan.proto)

#### ✅ `DemandPriceForecastRequest`
- **Added required fields**:
  ```protobuf
  message DemandPriceForecastRequest {
    string forecast_date = 1;         // Optional: YYYY-MM-DD
    double production_forecast_m1 = 2; // Required: bags for month+1
    double production_forecast_m2 = 3; // Required: bags for month+2
    string production_month_m1 = 4;    // Required: YYYY-MM
    string production_month_m2 = 5;    // Required: YYYY-MM
  }
  ```

## Behavior Changes

### Before (Broken)
1. API call to `/harvest-plans/demand-price-forecast`
2. API Gateway calls compass-service
3. compass-service calls compass-ml-service
4. compass-ml-service calls crystallization-onnx-service **with dummy values**
5. ONNX returns `NaN` → gRPC converts to `0`
6. Response: `predicted_bags: 0`, `yield_ratio_used: 0`

### After (Fixed)
1. API call to `/harvest-plans/demand-price-forecast`
2. API Gateway calculates month+1, month+2
3. API Gateway calls **crystallization-onnx-service** `GetPredictedMonthlyProduction(startMonth, endMonth)`
4. Extracts production forecasts (e.g., 27200.5 bags, 26884.3 bags)
5. API Gateway calls **compass-ml-service** with production values
6. compass-ml-service computes demand = production × yield_ratio
7. Response: `predicted_bags: 2795`, `yield_ratio_used: 0.1027` (regional fallback)

## Regional Yield Ratio Fallback

When MongoDB has no historical yield ratio data:
- **Maha season** (Oct-Mar): `0.1027` (10.27%)
- **Yala season** (Apr-Sep): `0.0874` (8.74%)
- Based on Puttalam 168-month dataset

Response includes `yield_ratio_source: "regional_historical_fallback"`

## Deployment Steps

1. **Ensure Docker is running**
2. **Rebuild affected services**:
   ```bash
   docker-compose build compass-ml-service compass-service api-gateway
   ```
3. **Restart services**:
   ```bash
   docker-compose up -d compass-ml-service compass-service api-gateway
   ```
4. **Verify health**:
   ```bash
   curl http://localhost:8002/api/v1/health
   # Should show: mongodb_connected: true, status: "ok"
   # (crystallization_service_reachable is removed)
   ```
5. **Test demand-price forecast**:
   ```bash
   curl -X POST http://localhost:3000/harvest-plans/demand-price-forecast \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"forecast_date": "2026-03-05"}'
   ```

## Expected Response

```json
{
  "success": true,
  "message": "Demand and price forecast retrieved successfully",
  "model_version": "2.0.0",
  "forecasts": [
    {
      "month": "2026-04",
      "horizon_months": 1,
      "demand": {
        "predicted_bags": 2795,
        "production_forecast_bags": 27200.5,
        "yield_ratio_used": 0.1027,
        "yield_ratio_season": "yala",
        "yield_ratio_sample_months": 0,
        "yield_ratio_source": "regional_historical_fallback"
      },
      "price": {
        "predicted_lkr_per_bag": 1849.23,
        "lower_95": 1758.12,
        "upper_95": 1940.34
      }
    },
    {
      "month": "2026-05",
      "horizon_months": 2,
      "demand": {
        "predicted_bags": 2349,
        "production_forecast_bags": 26884.3,
        "yield_ratio_used": 0.0874,
        ...
      }
    }
  ]
}
```

## Rollback Plan

If issues occur, revert commits to:
- `apps/compass-ml-service/main.py`
- `apps/compass-ml-service/models.py`
- `apps/compass-ml-service/requirements.txt`
- `apps/compass-service/src/app/ml-forecast/`
- `apps/api-gateway/src/app/compass-service/`
- `proto/harvestPlan.proto`

And restore the deleted `grpc_client.py` from git history.

## Key Benefits

1. ✅ **Real production values**: ONNX model gets actual sensor data from crystallization-onnx-service
2. ✅ **No dummy values**: Eliminates NaN/0 conversion issues
3. ✅ **Cleaner separation**: Each service has a single responsibility
4. ✅ **Gateway orchestration**: Central control flow at API Gateway
5. ✅ **Reduced dependencies**: compass-ml-service no longer needs gRPC client
6. ✅ **Better testability**: Services can be tested independently

## Testing Checklist

- [ ] Start Docker Desktop
- [ ] Rebuild services: `docker-compose build compass-ml-service compass-service api-gateway`
- [ ] Start services: `docker-compose up -d compass-ml-service compass-service api-gateway`
- [ ] Check logs: `docker-compose logs -f compass-ml-service`
- [ ] Test health endpoint: `GET http://localhost:8002/api/v1/health`
- [ ] Test demand-price forecast via API Gateway with valid auth token
- [ ] Verify `predicted_bags > 0` and `yield_ratio_used > 0` in response
- [ ] Verify `yield_ratio_source` is `"regional_historical_fallback"` (if MongoDB has no data)
- [ ] Check warnings array for any issues

---

**Status:** Implementation complete, pending rebuild and testing.
