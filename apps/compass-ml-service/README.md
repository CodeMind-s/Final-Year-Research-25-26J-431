# compass-ml-service

A Python FastAPI microservice that forecasts monthly salt demand and wholesale prices for Puttalam Salt Society landowners using production-yield estimation and SARIMAX time series modeling.

## Purpose

The Compass ML Service helps salt landowners plan harvests 2 months ahead by answering two critical questions:
1. **How much salt will be demanded?** (farm-level demand forecast)
2. **What price can I expect per bag?** (market-wide price forecast)

The output enables landowners in the Puttalam Salt Society to optimize harvest timing, workforce planning, and revenue projections. The service is designed for **per-farm forecasting**, not aggregate regional totals.

---

## Quick Start

### Local development (Docker Compose)

```bash
# From project root
docker-compose up compass-ml-service

# Service runs at http://localhost:8002
# Health check: curl http://localhost:8002/api/v1/health
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MODEL_DIR` | Path to directory containing model files | `/app/models` |
| `MONGO_URI` | MongoDB connection string | (required) |
| `MONGO_DB_NAME` | MongoDB database name | `test` |

### Model Files (Required in `MODEL_DIR`)

```
models/
├── price_sarimax.pkl          # Fitted SARIMAX model (statsmodels object)
├── price_sarimax_history.pkl  # Last 13 months price/production data (pandas DataFrame)
└── price_sarimax_meta.json    # Model version, performance metrics, column order
```

**Important**: The service will fail at startup if any of these three files are missing.

---

## Architecture

The Compass ML Service sits between the API Gateway (NestJS) and MongoDB. It does **NOT** call the crystallization-onnx-service directly — production forecasts are passed to it via the API Gateway as input.

```
┌─────────────────┐
│  API Gateway    │  (NestJS)
└────────┬────────┘
         │
         ├── 1. Call crystallization-onnx-service
         │      → Get production_forecast_m1, production_forecast_m2
         │
         ├── 2. Call compass-service (gRPC)
         │      → Forward production forecasts
         │
         └── 3. Call compass-ml-service (HTTP)
                → Demand = production × yield_ratio
                → Price = SARIMAX(price_history)
                → Return combined forecast
                ↓
         ┌──────────────────┐
         │  MongoDB         │
         │  ├─ ActualMonthlyProduction
         │  ├─ saltpricehistories (planned)
         │  └─ pricepredictions (write)
         └──────────────────┘
```

**Key Data Flow:**
- **Input**: `production_forecast_m1`, `production_forecast_m2` from crystallization-onnx-service (via API Gateway)
- **Process**: Demand algorithm + Price algorithm run independently
- **Output**: 2 forecast objects (month+1, month+2), each containing demand + price

---

## Demand Forecasting Algorithm

### Important: Output is Per-Landowner, Not PSS Total

The demand forecast represents **THIS FARM's estimated demand**, not the Puttalam Salt Society's total regional demand (~58,000 bags/month across all farms).

### How It Works

**Step 1: Receive Production Forecast**
```python
# From API Gateway (via crystallization-onnx-service LSTM model)
production_forecast_bags = 28715.31  # This farm's predicted production for April 2026
```

**Step 2: Detect Season**
```python
# Maha season = October through March (months 10, 11, 12, 1, 2, 3)
# Yala season = April through September (months 4, 5, 6, 7, 8, 9)
season = "yala" if month in [4,5,6,7,8,9] else "maha"
```

**Step 3: Lookup Yield Ratio**

The service attempts to calculate `yield_ratio` from live farm data in MongoDB:

```sql
-- If demand_kg field exists in ActualMonthlyProduction:
yield_ratio = MEAN(demand_kg / production_volume)
              WHERE season = target_season
              AND month IN (last 36 months)
```

**If live data unavailable** (current state — new platform):
```python
# Fallback to Puttalam Salt Society historical averages
# Derived from 168 months of PSS dataset (Jan 2012 - Dec 2025)
yield_ratio_maha = 0.1027  # 10.27% of production becomes demand
yield_ratio_yala = 0.0874  # 8.74% of production becomes demand
```

**Step 4: Compute Demand**
```python
predicted_bags = round(production_forecast_bags × yield_ratio)
```

### What the Output Represents

```python
# Example for April 2026 (Yala season):
production_forecast_bags = 28715.31  # This farm's production (from crystallization model)
yield_ratio = 0.0874                 # Yala season, PSS historical average
predicted_bags = 28715.31 × 0.0874 = 2510 bags  # THIS FARM's demand

# Context:
# PSS total across ~20 equivalent farms ≈ 581,911 bags/month production
# This farm ≈ 1/20 of that total
# The yield ratio is scale-invariant — it gives correct farm-level demand
# even when derived from PSS-level aggregate data
```

**Revenue Estimation:**
```python
predicted_revenue = predicted_bags × predicted_lkr_per_bag
                  = 2510 bags × 1628.51 LKR
                  = 4,087,560 LKR for April 2026
```

### yield_ratio_source Field

The API response includes `yield_ratio_source` to indicate data quality:

| Value | Meaning | Data Source |
|-------|---------|-------------|
| `"live_mongodb"` | Using this farm's actual deal history | MongoDB `ActualMonthlyProduction.demand_kg` |
| `"regional_historical_fallback"` | Using PSS aggregate averages | Hardcoded constants (0.1027/0.0874) |
| `"none"` | No production forecast available | — |

**The service transitions automatically** when `demand_kg` data accumulates. No code change or restart required.

### Limitations

- **Accuracy**: ~7-13% error (validated on PSS historical data)
- **Cold Start**: Using regional proxy until 6-12 months of live farm deals are recorded
- **Simplifying Assumptions**:
  - Does not account for individual buyer relationships
  - Does not account for contract demand vs spot demand
  - Assumes yield ratio is stable within a season

---

## Price Forecasting Algorithm

### Important: Output is Market-Wide, Not Farm-Specific

The price forecast represents the **expected Puttalam wholesale market price** that applies to all landowners in the PSS area equally. It is **NOT** specific to one farm's negotiated deals.

### How It Works

**Step 1: Load Pre-Trained SARIMAX Model at Startup**
```python
# Loaded from models/price_sarimax.pkl
# Trained on 168 months of PSS wholesale prices (Jan 2012 - Dec 2025)
# Model specification: SARIMA(1,1,1)(0,1,1,12)
#   (p,d,q) = (1,1,1)         # AutoRegressive, Differencing, Moving Average
#   (P,D,Q,s) = (0,1,1,12)    # Seasonal pattern repeats every 12 months
```

**Step 2: Build Exogenous Feature Vector**

The model requires 4 features in this exact order:

```python
exog = [
    is_maha_season,           # 1 if month in [Oct-Mar], else 0
    price_lag_12m,            # Price from same month last year
    price_lag_1m,             # Most recent actual price (Dec 2025 = 1651.71 LKR)
    total_production_bags     # PSS total production volume
]
```

Data source (with fallback):
- **Primary**: MongoDB `saltpricehistories` collection (live prices)
- **Fallback**: `price_sarimax_history.pkl` (pre-loaded 13 months)
- If MongoDB unavailable → fallback is used silently, warning added to response

**Step 3: Two-Pass Forecast (Prevents Data Leakage)**

**Pass 1: Forecast Month+1**
```python
# Use LAST KNOWN ACTUAL price as price_lag_1m
exog_m1 = [is_maha(4), price_lag_12m=1603.21, price_lag_1m=1651.71, prod=581911]
forecast_m1 = model.get_forecast(steps=1, exog=exog_m1)
# Result: 1628.51 LKR/bag (April 2026)
```

**Pass 2: Forecast Month+2**
```python
# Use MONTH+1 PREDICTION as price_lag_1m (NOT actual — actual doesn't exist yet)
exog_m2 = [is_maha(5), price_lag_12m=1615.33, price_lag_1m=1628.51, prod=581911]
forecast_m2 = model.get_forecast(steps=2, exog=[exog_m1, exog_m2])
# Result: 1640.21 LKR/bag (May 2026)
```

This two-pass approach prevents "future data leakage" — the month+2 forecast cannot use the actual month+1 price because it hasn't happened yet.

**Step 4: Return Point Estimate + 95% Confidence Interval**
```python
{
    "predicted_lkr_per_bag": 1628.51,
    "lower_95": 1589.01,      # 95% confidence interval lower bound
    "upper_95": 1668.00,      # 95% confidence interval upper bound
    "expected_mape_pct": 1.164  # Expected error ±1.164%
}
```

### What the Output Represents

```python
# April 2026: 1628.51 LKR/bag (CI: 1589 – 1668)
# May   2026: 1640.21 LKR/bag (CI: 1587 – 1693)

# This is the Puttalam wholesale market price.
# All landowners in the PSS area receive approximately this price.
# Individual farm deals may vary by ±5% due to:
#   - Buyer relationships
#   - Salt quality/grade
#   - Payment terms (cash vs credit)
```

The slight price increase from April to May (△11.70 LKR) reflects **seasonal patterns** detected in historical data — Yala season typically has slightly higher prices due to lower production volumes.

### Model Performance (Validated on 34 Rolling Windows, 2023-2025)

| Metric | Month+1 | Month+2 | Interpretation |
|--------|---------|---------|----------------|
| **MAPE** | 1.164% | 1.353% | Mean Absolute Percentage Error (~±19 LKR on 1628 LKR price) |
| **RMSE** | 21.8 LKR | 25.18 LKR | Root Mean Squared Error |
| **Directional Accuracy** | 46.3% | — | Below coin-flip (⚠️ see below) |
| **Evaluation Method** | Rolling Origin | Leakage-Free | Month+2 uses predicted lag, not actual |

**Important Note on Directional Accuracy**:

The SARIMAX model has **MAPE ≈ 1.2%** (very accurate price level prediction) but **directional accuracy of 46.3%** (slightly below coin-flip for up/down direction).

**This means:**
- ✅ The predicted price **LEVEL** is accurate (within ~21 LKR/bag)
- ⚠️  The model **cannot reliably predict** whether price will go UP or DOWN

**For procurement planning this is acceptable** — operations teams need the price level for budget calculation, not the direction. The `directional_accuracy` field is stored in `meta.json` for internal monitoring only and is **NOT** exposed in the API response to avoid confusion.

### Fallback Behavior

```python
# Priority 1: Live MongoDB price history
price_history = mongo.get_price_history(months=13)

# Priority 2: Pre-loaded pickle fallback
if len(price_history) < 13:
    price_history = load("models/price_sarimax_history.pkl")
    warnings.append("Using price_sarimax_history.pkl as fallback")
```

The fallback is transparent — the API response includes a `warnings` array documenting which data source was used.

### Limitations

- **Directional Prediction**: 46% accuracy (below baseline) — do not use for trading decisions
- **Model Staleness**: Should be retrained monthly as new PSS data becomes available
- **Market Assumptions**:
  - Assumes Puttalam market operates as a single price zone
  - Does not account for external shocks (policy changes, import/export restrictions)
  - Trained on government/PSS aggregate data — may not reflect boutique/premium salt prices

---

## MongoDB Collections

### ActualMonthlyProduction (READ)

**Purpose**: Yield ratio calculation and production history

**Current Schema** (36 records exist):
```javascript
{
  "landownerId": ObjectId("..."),
  "month": "2024-11",              // string format "YYYY-MM"
  "production_volume": 20753.8,    // this farm's actual production (bags)
  "season": "Maha"                 // "Maha" or "Yala"
}
```

**Future Schema** (Phase 2 migration — see [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md)):
```javascript
{
  "landownerId": ObjectId("..."),
  "month": "2024-11",
  "production_volume": 20753.8,
  "demand_kg": 2142.5,             // ← NEW FIELD: aggregated from deals
  "price_mean_lkr_per_kg": 150.3,  // ← NEW FIELD: mean(pricePerKilo)
  "season": "Maha"
}
```

When `demand_kg` appears in documents, the service **automatically switches** from regional fallback to live farm-specific yield ratios. No code changes needed.

### saltpricehistories (READ)

**Purpose**: Price forecasting exogenous variables

**Status**: **Does not exist yet** — service falls back to `price_sarimax_history.pkl` immediately

**Planned Schema** (Phase 3 migration):
```javascript
{
  "month": "2025-12",              // string format "YYYY-MM"
  "price_mean": 1651.71,           // LKR per bag (aggregated from deals)
  "total_production_bags": 581911, // PSS total production across all farms
  "is_maha_season": 1              // 1 if Maha, 0 if Yala
}
```

### pricepredictions (WRITE)

**Purpose**: Audit trail of forecasts made

The service **writes** to this collection after each successful price forecast. One document per forecast month per API call.

**Schema**:
```javascript
{
  "forecast_date": "2026-03-05",   // date forecast was run
  "month": "2026-04",              // target month being forecast
  "horizon_months": 1,             // 1 or 2
  "predicted_lkr_per_bag": 1628.51,
  "lower_95": 1589.01,
  "upper_95": 1668.00,
  "model_version": "price_sarimax_v1.0",
  "expected_mape_pct": 1.164,
  "created_at": ISODate("2026-03-06T04:15:23.112Z")
}
```

**Failure Handling**: Writes to this collection are non-fatal. If MongoDB is unavailable, the API response still succeeds — writes are logged as warnings.

---

## API

### POST /api/v1/demand-price-forecast

**Request Body:**
```json
{
  "forecast_date": "2026-03-05",
  "production_forecast_m1": 28715.3,   // ← from crystallization-onnx-service
  "production_forecast_m2": 27049.5,   // ← from crystallization-onnx-service
  "production_month_m1": "2026-04",
  "production_month_m2": "2026-05"
}
```

**Validation:**
- `production_forecast_m1`, `production_forecast_m2` must be > 0
- `production_month_m1`, `production_month_m2` must match format `YYYY-MM`
- `forecast_date` defaults to today if omitted

**Response:** (HTTP 200)
```json
{
  "model_version": "price_sarimax_v1.0",
  "requested_at": "2026-03-06T08:42:42.536119Z",
  "forecast_date": "2026-03-05",
  "last_price_data_date": "2025-12-01",
  "data_gap_months": 3,
  "forecasts": [
    {
      "month": "2026-04",
      "horizon_months": 1,
      "demand": {
        "predicted_bags": 2510,
        "method": "production_yield_ratio",
        "production_source": "crystallization_onnx_service",
        "production_forecast_bags": 28715.31,
        "yield_ratio_used": 0.0874,
        "yield_ratio_season": "yala",
        "yield_ratio_sample_months": 0,
        "yield_ratio_source": "regional_historical_fallback"
      },
      "price": {
        "predicted_lkr_per_bag": 1628.51,
        "lower_95": 1589.01,
        "upper_95": 1668.00,
        "model": "SARIMAX",
        "expected_mape_pct": 1.164
      }
    },
    {
      "month": "2026-05",
      "horizon_months": 2,
      "demand": {
        "predicted_bags": 2364,
        "production_forecast_bags": 27049.46,
        "yield_ratio_used": 0.0874,
        "yield_ratio_season": "yala",
        "yield_ratio_sample_months": 0,
        "yield_ratio_source": "regional_historical_fallback"
      },
      "price": {
        "predicted_lkr_per_bag": 1640.21,
        "lower_95": 1587.06,
        "upper_95": 1693.35,
        "expected_mape_pct": 1.353
      }
    }
  ],
  "warnings": [
    "Demand yield ratio using regional Puttalam historical data (Maha=0.1027, Yala=0.0874). Platform will switch to live farm data automatically once deal history accumulates.",
    "MongoDB price history collection unavailable or empty. Using price_sarimax_history.pkl as fallback."
  ]
}
```

**Error Responses:**

| Status | Reason | Detail |
|--------|--------|--------|
| 422 | Validation Error | Invalid request body (e.g., `production_forecast_m1 <= 0`) |
| 503 | Service Unavailable | SARIMAX model failed to load at startup |

### GET /api/v1/health

**Response:** (HTTP 200 or 503)
```json
{
  "status": "ok",                               // "ok" | "degraded" | "unhealthy"
  "sarimax_model_loaded": true,
  "sarimax_version": "price_sarimax_v1.0",
  "sarimax_last_data_date": "2025-12-01",
  "data_gap_months": 3,                         // Months since last training data
  "mongodb_connected": true
}
```

**Status Codes**:
- `200` + `"status": "ok"` → All systems operational
- `200` + `"status": "degraded"` → SARIMAX loaded but MongoDB unreachable (API still functional via pkl fallback)
- `503` + `"status": "unhealthy"` → SARIMAX model failed to load (API non-functional)

**Monitoring Alert**: If `data_gap_months > 2`, the price model is stale — retrain ASAP.

---

## Model Files

### price_sarimax.pkl

**Type**: `statsmodels.tsa.statespace.sarimax.SARIMAXResultsWrapper` (pickled Python object)

**Contents**: Fitted SARIMAX model trained on 168 months of Puttalam wholesale price data

**Size**: ~2-4 MB (varies by model complexity)

**Update Frequency**: Monthly (recommended), or when `data_gap_months > 2`

### price_sarimax_history.pkl

**Type**: `pandas.DataFrame` (pickled)

**Schema**:
```python
DataFrame columns:
  - date                  : datetime64 (monthly timestamps)
  - price_mean            : float64    (LKR per bag)
  - total_production_bags : float64    (PSS total production)
  - is_maha_season        : int64      (1 if Maha, 0 if Yala)
```

**Contents**: Last 13 months of price/production data (used for lag lookups when MongoDB unavailable)

**Size**: ~2-5 KB

**Purpose**: Fallback when live MongoDB price history is insufficient (<13 records)

### price_sarimax_meta.json

**Contents**: Model metadata, performance metrics, inference instructions

**Schema**:
```json
{
  "version": "price_sarimax_v1.0",
  "model_order": [1, 1, 1],
  "seasonal_order": [0, 1, 1, 12],
  "exog_cols": ["is_maha_season", "price_lag_12m", "price_lag_1m", "total_production_bags"],
  "exog_col_order": "MUST match this exact order when building numpy array for inference",
  "last_data_date": "2025-12-01",
  "total_train_months": 168,
  "training_date": "2026-03-04 20:19:43",
  "performance": {
    "month_plus_1_mape": 1.164,
    "month_plus_2_mape": 1.353,
    "month_plus_1_rmse": 21.8,
    "month_plus_2_rmse": 25.18,
    "directional_accuracy_pct": 46.3,
    "evaluation_windows": 34,
    "evaluation_period": "2023-01 to 2025-12",
    "evaluation_method": "rolling origin, leakage-free (month+2 uses predicted lag)"
  },
  "artifacts": {
    "model": "price_sarimax.pkl",
    "history": "price_sarimax_history.pkl",
    "meta": "price_sarimax_meta.json"
  }
}
```

**Read at Startup**: The service logs `version` and `last_data_date` during initialization

**Runtime Usage**: `performance.month_plus_1_mape` and `performance.month_plus_2_mape` are returned in API responses as `expected_mape_pct`

### How to Retrain

When new monthly PSS price data becomes available (or when `data_gap_months > 2`):

1. Run `sarimax_price_model.py` notebook in Google Colab with updated dataset
2. Download the 3 generated files:
   - `price_sarimax.pkl`
   - `price_sarimax_history.pkl`
   - `price_sarimax_meta.json`
3. Replace files in `models/` directory (Docker volume mount)
4. Restart the service: `docker-compose restart compass-ml-service`

**No code changes needed** for routine retraining — the service reads `meta.json` at startup and automatically uses updated performance metrics in responses.

---

## Data Evolution Roadmap

The service is designed to **automatically improve** as live farm data accumulates, without requiring code changes or redeployments.

### Phase 1: Launch → 6 Months (Current State)

**Demand Algorithm:**
- Uses regional fallback yield ratios (Maha: 0.1027, Yala: 0.0874)
- Derived from 168 months of Puttalam Salt Society aggregate data
- `yield_ratio_source`: `"regional_historical_fallback"`
- `yield_ratio_sample_months`: `0`

**Price Algorithm:**
- SARIMAX trained on PSS wholesale price data (2012-2025)
- Fallback: `price_sarimax_history.pkl` (13 months)
- `warnings`: `"Using price_sarimax_history.pkl as fallback"`

**User-Facing Warning:**
```
"Demand yield ratio using regional Puttalam historical data (Maha=0.1027, Yala=0.0874). 
 Platform will switch to live farm data automatically once deal history accumulates."
```

This is **informational, not an error**. The model is functional and accurate for planning purposes.

### Phase 2: 6+ Months Post-Launch (Automatic Transition)

**When deal history accumulates**, run this MongoDB aggregation monthly:

```javascript
// Aggregate CLOSED deals for month "2026-03" and update ActualMonthlyProduction
db.deals.aggregate([
  { 
    $match: { 
      status: "CLOSED", 
      acceptedAt: { 
        $gte: ISODate("2026-03-01"), 
        $lt: ISODate("2026-04-01") 
      } 
    } 
  },
  { 
    $group: { 
      _id: "$landownerId",
      demand_kg: { $sum: "$quantity" },
      price_mean_lkr_per_kg: { $avg: "$pricePerKilo" }
    }
  }
]).forEach(function(doc) {
  db.actualmonthlyproductions.updateOne(
    { landownerId: doc._id, month: "2026-03" },
    { $set: { 
        demand_kg: doc.demand_kg, 
        price_mean_lkr_per_kg: doc.price_mean_lkr_per_kg 
      } 
    }
  );
});
```

**Once `demand_kg` exists in documents:**
- ✅ `mongo_client.py` **automatically switches** from fallback to live farm-specific yield ratio
- ✅ No code changes needed
- ✅ No service restart required
- ✅ `yield_ratio_source` changes to `"live_mongodb"`
- ✅ `yield_ratio_sample_months` becomes > 0
- ✅ Warning disappears from API response

**Expected Accuracy Improvement:**
- Phase 1: ~10-13% MAPE (regional proxy)
- Phase 2: ~7-9% MAPE (farm-specific historical data)

### Phase 3: 12+ Months Post-Launch (Manual Retrain)

**Retrain SARIMAX model** using your own farm's `pricePerKilo` history instead of government dataset:

1. Export deal history from MongoDB:
   ```javascript
   db.deals.aggregate([
     { $match: { status: "CLOSED" } },
     { $group: { 
         _id: { $dateToString: { format: "%Y-%m", date: "$acceptedAt" } },
         price_mean: { $avg: "$pricePerKilo" },
         total_production_bags: { $sum: "$quantity" }
     }},
     { $sort: { _id: 1 } }
   ])
   ```

2. Run `sarimax_price_model.py` with this dataset (replaces PSS 2012-2025 data)

3. Replace model files in `models/` directory and restart

**Expected Accuracy Improvement:**
- Phase 1-2: ~1.2% MAPE (PSS market-wide data)
- Phase 3: ~0.8-1.0% MAPE (fully personalized to your farm's trading patterns)

---

## Dependencies

```
Python 3.11
fastapi==0.111.0          # Web framework
uvicorn[standard]==0.29.0 # ASGI server
pydantic==2.7.1           # Data validation
statsmodels==0.14.2       # SARIMAX time series model
pandas==2.2.2             # DataFrame operations
numpy==1.26.4             # Numerical computing
pymongo==4.7.2            # MongoDB driver
scipy==1.13.0             # Statistical functions (statsmodels dependency)
```

**No gRPC dependencies** — this service was refactored to be a pure HTTP service in March 2026.

---

## Monitoring & Alerts

### Health Check (Kubernetes/Docker)

```bash
# Liveness probe
curl -f http://localhost:8002/api/v1/health || exit 1

# Expected response: {"status": "ok", ...}
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| `data_gap_months` | > 2 | Retrain price model ASAP |
| `mongodb_connected` | `false` | Alert DevOps — service still functional via pkl fallback |
| `warnings` array length | > 0 | Log for analysis (not necessarily an error) |
| HTTP 503 responses | > 0 | CRITICAL — SARIMAX model failed to load |

### Logging

The service uses Python `logging` with structured output:

```
2026-03-06 08:42:35 [INFO] main — SARIMAX meta loaded — version: price_sarimax_v1.0, last_data_date: 2025-12-01
2026-03-06 08:42:36 [INFO] main — SARIMAX model loaded from /app/models/price_sarimax.pkl
2026-03-06 08:42:36 [INFO] main — SARIMAX history pkl loaded — 13 rows
2026-03-06 08:42:37 [INFO] mongo_client — MongoDB connected — database: brinex
2026-03-06 08:43:12 [INFO] forecast — Wrote price prediction for month 2026-04 (horizon 1)
2026-03-06 08:43:12 [INFO] forecast — Wrote price prediction for month 2026-05 (horizon 2)
```

---

## Troubleshooting

### Startup Error: "SARIMAX model failed to load"

**Cause**: Missing or corrupt `price_sarimax.pkl` in `MODEL_DIR`

**Fix**:
```bash
# Check model files exist
docker exec compass-ml-service ls -lh /app/models/

# Expected output:
# price_sarimax.pkl
# price_sarimax_history.pkl
# price_sarimax_meta.json
```

If files are missing, re-download from model training artifact storage and restart.

### Warning: "MongoDB price history unavailable"

**Cause**: `saltpricehistories` collection does not exist yet (expected in Phase 1-2)

**Fix**: This is **not an error** — the service falls back to `price_sarimax_history.pkl` automatically. API responses are still accurate.

To remove this warning, implement Phase 3 migration (populate `saltpricehistories` collection).

### Demand Forecast Returns `null`

**Cause**: `production_forecast_m1` or `production_forecast_m2` is `null`, `0`, or `NaN`

**Fix**: Check crystallization-onnx-service output — it may be failing to generate production forecasts. The compass-ml-service cannot infer demand without production input.

### Price Confidence Intervals Too Wide

**Example**: `lower_95: 1450, upper_95: 1810` (360 LKR spread)

**Cause**: Price volatility in training data or insufficient historical data

**Fix**: 
1. Retrain model with more recent data (reduces historical volatility impact)
2. Check for outliers in `price_sarimax_history.pkl` data
3. Consider reducing forecast horizon to month+1 only (month+2 always has wider CI)

---

## Architecture Decisions

### Why Production Forecasts Are Input (Not Fetched Internally)

**Decision**: The API Gateway orchestrates both crystallization-onnx-service and compass-ml-service, passing production forecasts as input.

**Alternative Rejected**: compass-ml-service calls crystallization-onnx-service via gRPC directly.

**Rationale**:
1. **Separation of Concerns**: Compass-ML focuses on demand/price only, not production prediction
2. **No Circular Dependencies**: Prevents microservice coupling
3. **Flexibility**: API Gateway can batch/cache crystallization calls for multiple landowners
4. **Testability**: compass-ml-service can be tested with mock production values without standing up crystallization service

### Why Two-Pass Price Forecast (Not Single Multi-Step)

**Decision**: Forecast month+1 first, then use that prediction as `price_lag_1m` for month+2.

**Alternative Rejected**: Single `get_forecast(steps=2)` call with same exog for both steps.

**Rationale**:
1. **Data Leakage Prevention**: Month+2 cannot use actual month+1 price (it hasn't happened yet)
2. **Realistic Simulation**: Matches how the model will be used in production (no future data)
3. **Validation Accuracy**: Rolling-origin evaluation uses the same two-pass logic, so reported MAPE reflects true production performance

### Why `yield_ratio_source` Is Explicit (Not Inferred)

**Decision**: API response includes `"yield_ratio_source": "regional_historical_fallback"` field.

**Alternative Rejected**: Hide data source from user, only expose final `predicted_bags`.

**Rationale**:
1. **Transparency**: Users understand when model is using proxy data vs live farm data
2. **Trust**: Explicit warnings reduce "black box" perception of ML models
3. **Product Roadmap**: Provides clear path to "Phase 2" (live data) without breaking API contract
4. **Debugging**: DevOps can identify if MongoDB migration hasn't happened yet

---

## References

- **SARIMAX Model**: [Statsmodels SARIMAX Documentation](https://www.statsmodels.org/stable/generated/statsmodels.tsa.statespace.sarimax.SARIMAX.html)
- **MongoDB Schema**: See [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) for detailed migration plan
- **Yield Ratio Dataset**: Puttalam Salt Society historical data (2012-2025, 168 months)
- **Price Dataset**: PSS wholesale price records (2012-2025, 168 months)
- **Retraining Notebook**: `sarimax_price_model.py` (Google Colab, not included in this repo)

---

## License

Proprietary — BrineX Platform, Final Year Research Project 2025-26J-431
