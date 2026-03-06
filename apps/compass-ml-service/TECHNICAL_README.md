# compass-ml-service — Technical Reference

## What This Service Does

The compass-ml-service predicts monthly salt demand and wholesale prices for Puttalam Salt Society landowners two months into the future. When a landowner logs into their dashboard, the service receives their upcoming production forecast (how many bags of salt their beds will crystallize) from a teammate's LSTM neural network model, converts that production into expected deal demand using historical yield ratios that account for seasonal buying patterns, and simultaneously forecasts the market-wide price using a SARIMAX statistical model trained on 168 months of PSS wholesale price history. The output — demand in bags and price in LKR per bag, with confidence intervals — enables landowners to plan workforce allocation, negotiate distributor contracts in advance, and project monthly revenue before the salt has fully crystallized.

---

## How a Landowner Gets Their Forecast

### The Complete Flow (Step by Step)

**Step 1: PSS staff enter daily sensor readings**

Each morning, Puttalam Salt Society field staff visit the shared facility salt pans and manually measure 8 physical parameters using graduated scales and thermometers. These readings are entered through the API Gateway's `POST /crystallization/daily-measurements` endpoint and stored in the `dailymeasurements` MongoDB collection. The 8 sensor fields represent critical environmental conditions:

- **water_temperature** (°C): Temperature of brine in evaporation ponds. Higher temperatures accelerate evaporation. Typically 28-35°C.
- **lagoon** (depth in feet): Water level in the initial lagoon reservoir where seawater is first collected. Range 0-5 feet.
- **OR_brine_level** (depth in feet): Brine depth in the Outer Reservoir ponds. Higher levels = more dissolved salt available for crystallization. Range 0-5 feet.
- **OR_bund_level** (height in feet): Embankment/wall height around Outer Reservoir ponds. Structural integrity indicator. Range 0-5 feet.
- **IR_brine_level** (depth in feet): Brine depth in the Inner Reservoir (final crystallization beds). High levels here directly predict high salt yield. Range 0-5 feet.
- **IR_bound_level** (height in feet): Embankment height around Inner Reservoir. Range 0-5 feet.
- **East_channel** (depth in feet): Water depth in the eastern supply channel feeding the ponds. High channel depth = good water flow and facility health. Range 0-5 feet.
- **West_channel** (depth in feet): Water depth in the western supply channel. Range 0-5 feet.

**Why these values matter**: High brine levels (especially IR_brine_level) combined with high channel depths indicate optimal conditions — more dissolved salt entering the system and sufficient water flow. A fully operational facility might show IR_brine_level = 4-5 feet and East_channel = 4-5 feet. Test data with all values at 2.0 represents a poorly performing or underutilized facility, which the ONNX model correctly interprets as low production potential.

Sample document from `dailymeasurements` collection:
```json
{
  "_id": "ObjectId(...)",
  "date": "2026-03-07",
  "parameters": {
    "water_temperature": 32.0,
    "lagoon": 3.5,
    "OR_brine_level": 4.2,
    "OR_bund_level": 4.8,
    "IR_brine_level": 4.5,
    "IR_bound_level": 5.0,
    "East_channel": 4.0,
    "West_channel": 3.8
  },
  "createdAt": "2026-03-07T06:30:00Z"
}
```

**Step 2: Landowner opens their dashboard**

The landowner logs into the web application using their credentials. The JWT token issued by the auth-service contains their `userId` (which is their `landowner_id` in the database) and role `LANDOWNER`. When they navigate to the forecast section of the dashboard, the frontend sends a request to the API Gateway at `POST /api/v1/harvest-plans/demand-price-forecast` with the JWT Bearer token in the Authorization header. The landowner does not need to specify which facility or which sensor readings to use — the system automatically uses the latest PSS facility-wide readings because all landowners share the same central evaporation ponds managed by the Salt Society.

**Step 3: API Gateway calls crystallization service**

The API Gateway extracts the `landowner_id` from the JWT token and calculates the next two months from today's date (or from an optional `forecast_date` in the request body). It then calls the crystallization-service via gRPC:

```typescript
const crystallizationRequest = {
  startMonth: "2026-04",  // month+1
  endMonth: "2026-05",    // month+2
  landowner_id: landownerId,  // from JWT
};

// gRPC call
this.crystallizationService.GetPredictedMonthlyProduction(crystallizationRequest)
```

The crystallization-service receives this request and does the following:
1. Fetches the **latest** `dailymeasurements` document from MongoDB (sorted by `date` descending).
2. Extracts the 8 sensor values from `parameters`.
3. Calls the crystallization-onnx-service (Component 1 — LSTM model) via gRPC with these current sensor values plus forecast parameters.
4. The ONNX service returns a **facility-level** production forecast for the next 12 months (this is the PSS total across all landowners' beds — approximately 7500 beds facility-wide).
5. The crystallization-service **scales down** the facility forecast to this specific landowner's portion:

```javascript
// Lookup this landowner's bed count from database
const landownerBeds = 25;  // example: this landowner owns 25 beds
const facilityTotalBeds = 7500;  // PSS total

// Scale facility forecast to landowner's share
scaled_production_m1 = facility_forecast_m1 × (landownerBeds / facilityTotalBeds)
                     = 172,000 bags × (25 / 7500)
                     = 573.33 bags

scaled_production_m2 = facility_forecast_m2 × (25 / 7500)
                     = 97.00 bags (for month+2)
```

6. The scaled forecast is saved to the `landownermonthlyproductionpredictions` collection:

```json
{
  "_id": "ObjectId(...)",
  "landownerId": "ObjectId(landowner123)",
  "month": "2026-04",
  "productionForecast": 97.00,
  "season": "Yala",
  "facilityProductionForecast": 291000.0,
  "numberOfBeds": 25,
  "modelVersion": "crystallization_lstm_v2.1",
  "predictionDate": "2026-03-07T10:15:00Z",
  "basedOnSensorDate": "2026-03-07",
  "createdAt": "2026-03-07T10:15:00Z"
}
```

7. The crystallization-service returns the scaled production forecasts to the API Gateway:

```json
{
  "success": true,
  "message": "Production forecasts retrieved",
  "data": [
    {
      "month": "2026-04",
      "productionForecast": 97.00,
      "season": "Yala",
      "numberOfBeds": 25
    },
    {
      "month": "2026-05",
      "productionForecast": 103.50,
      "season": "Yala",
      "numberOfBeds": 25
    }
  ]
}
```

**Step 4: API Gateway calls compass-ml-service**

The API Gateway now has the landowner-specific production forecasts. It constructs an HTTP POST request to compass-ml-service at `http://compass-ml-service:8002/api/v1/demand-price-forecast`:

Request body:
```json
{
  "forecast_date": "2026-03-07",
  "production_forecast_m1": 97.00,
  "production_forecast_m2": 103.50,
  "production_month_m1": "2026-04",
  "production_month_m2": "2026-05",
  "season_m1": "Yala",
  "season_m2": "Yala"
}
```

**Field explanations**:
- `forecast_date`: The reference date (today). The service calculates month+1 and month+2 from this.
- `production_forecast_m1`: Number of bags this landowner will produce in April 2026 (from ONNX model).
- `production_forecast_m2`: Number of bags for May 2026.
- `production_month_m1`: The target month being forecast (must match month+1 from forecast_date).
- `production_month_m2`: Second target month (must match month+2).
- `season_m1`: Season classification for April ("Yala" = Apr-Sep, "Maha" = Oct-Mar, "Transition" = other).
- `season_m2`: Season classification for May.

The season is passed explicitly from the crystallization service because it's computed during the ONNX prediction process (the LSTM model internally uses season as a feature). This avoids recalculating season in compass-ml-service and ensures consistency.

**Step 5: Demand is calculated (forecast.py)**

The compass-ml-service receives the request and immediately calls `forecast_demand()` function in `forecast.py`. The demand algorithm follows these steps:

**Formula**:
```python
demand_bags = production_forecast × yield_ratio
```

**What is yield_ratio?** Historically across the Puttalam Salt Society, only a portion of produced salt gets immediately sold through the digital deals marketplace. The rest is stored for later spot sales, government procurement, or bulk contracts. The yield_ratio represents the percentage of production that becomes "demand" (active deals) in the same month. This ratio varies by season because distributor buying patterns differ — during the wet Maha season (October-March), demand is higher relative to production because salt quality is better and market prices are favorable. During the dry Yala season (April-September), distributors stockpile less aggressively, so the ratio drops.

**Season values with physical explanation**:
```python
# Derived from 168 months (14 years) of PSS historical data (2012-2025)
REGIONAL_YIELD_RATIO_MAHA = 0.1027  # Maha (Oct-Mar): wet season, higher demand
REGIONAL_YIELD_RATIO_YALA = 0.0874  # Yala (Apr-Sep): dry season, lower demand
REGIONAL_YIELD_RATIO_TRANSITION = 0.0951  # Average of both (not currently used)
```

**Why Maha has higher yield**: The Maha season (monsoon period) produces salt with better crystal structure and lower impurities because temperature fluctuations are smaller. Distributors prefer Maha salt for premium retail markets, so they actively book deals in advance. Yala salt is still high quality but slightly less consistent, leading to more deferred sales and a lower yield ratio.

**Worked example with test data (poor sensor conditions)**:
```python
# Test data: all sensors at ~2.0 (poorly performing facility)
production_forecast_m1 = 43.02 bags  # Low because ONNX interprets weak sensor signals
season_m1 = "Yala"
yield_ratio = 0.0874

demand_bags = 43.02 × 0.0874 = 3.76 → rounds to 4 bags
```

This means if the sensor readings are poor (indicating low brine levels, weak water flow), the ONNX model predicts minimal salt production, which cascade into minimal demand. The landowner would see "4 bags expected demand for April" — a flag that something is wrong with the facility or the sensor data is stale/test data.

**Worked example with realistic data (normal sensor conditions)**:
```python
# Realistic data: sensors showing healthy facility operation
production_forecast_m1 = 97.00 bags  # ONNX model sees good IR_brine_level, channel depths
season_m1 = "Yala"
yield_ratio = 0.0874

demand_bags = 97.00 × 0.0874 = 8.4778 → rounds to 8 bags (integer)
```

**Worked example for Maha season (higher ratio)**:
```python
# Same production, but Maha season
production_forecast_m1 = 97.00 bags
season_m1 = "Maha"
yield_ratio = 0.1027

demand_bags = 97.00 × 0.1027 = 9.9619 → rounds to 10 bags
```

Notice the demand increased by 2 bags (25% more) despite identical production, purely because Maha season has historically stronger distributor buying.

**yield_ratio_source explained**:

The service attempts to compute a farm-specific yield ratio by querying the `ActualMonthlyProduction` collection and calculating:
```python
live_ratio = MEAN(demand_kg / production_volume)
             WHERE season = target_season
             AND month IN (last 36 months)
```

However, in Phase 1 (current deployment), the `demand_kg` field does not exist in `ActualMonthlyProduction` — the database only has `production_volume` and `season`. Therefore, the service always falls back to the regional historical ratios (0.1027 for Maha, 0.0874 for Yala). The API response includes:

```json
"yield_ratio_source": "regional_historical_fallback"
```

This is **not an error** — it's expected in Phase 1. The response also includes a warning:
```
"Demand yield ratio using regional Puttalam historical data (Maha=0.1027, Yala=0.0874, Transition=0.0951). Platform will switch to live farm data automatically once deal history accumulates."
```

The service will automatically switch to `"yield_ratio_source": "live_mongodb"` when:
1. CLOSED deals start accumulating in the `deals` collection (6+ months of live operation).
2. A scheduled monthly aggregation job (not yet implemented) computes `demand_kg` for each landowner and writes it back to `ActualMonthlyProduction`.
3. The service queries and finds at least 12 months of records with `demand_kg` present.

No code changes or service restart required — the transition is automatic.

**Step 6: Price is calculated (forecast.py)**

After demand is computed, the service calls `forecast_price()` in `forecast.py`. The price forecast is **completely independent** of sensor data — it only uses historical wholesale market prices and production volume. This is intentional: daily sensor readings describe short-term facility conditions (which affect production), but wholesale salt prices are driven by regional supply-demand economics, government policy, seasonal buying trends, and long-term market momentum. The ONNX model's job is to predict bags produced; the SARIMAX model's job is to predict what those bags will sell for on the market.

**What is SARIMAX?** SARIMAX stands for Seasonal AutoRegressive Integrated Moving Average with eXogenous variables. In plain terms: a statistical model that learns repeating patterns in time series data (like monthly prices) and uses them to predict future values. The "Seasonal" part means it detects patterns that repeat every 12 months (e.g., prices tend to rise in November-December before holiday demand and drop in June-July during monsoon). The "eXogenous" part means it can use external inputs (like production volume or last year's price) to improve predictions.

**Training data**: The model was trained on 168 months (January 2012 through December 2025) of Puttalam Salt Society wholesale price data collected from government market bulletins and PSS internal records. Each month has:
- `price_mean`: Average LKR per bag sold that month
- `total_production_bags`: PSS facility-wide production volume
- `is_maha_season`: 1 if month is Oct-Mar, 0 if Apr-Sep

**Model specification**:
```
SARIMAX(1, 1, 1) × (0, 1, 1, 12)
```
- `(p, d, q) = (1, 1, 1)`: Uses the last 1 month's price, takes 1 difference to remove trend, accounts for 1 month's error correction.
- `(P, D, Q, s) = (0, 1, 1, 12)`: Takes 1 seasonal difference (compares to same month last year), corrects for 1 month of seasonal error, pattern repeats every 12 months.

**Input features at runtime** (must be provided in this exact order):
```python
exog = [
  is_maha_season,      # 1 if forecasting Oct-Mar, 0 otherwise
  price_lag_12m,       # Price from the same month last year (e.g., Apr 2025 for Apr 2026 forecast)
  price_lag_1m,        # Most recent actual price (Dec 2025 = 1651.71 LKR in training data)
  total_production_bags # Latest PSS production volume (currently uses Dec 2025 = 581,911 bags)
]
```

**Two-pass forecast process** (critical for month+2 accuracy):

The service cannot directly forecast month+2 because it needs `price_lag_1m` (the price from 1 month ago). But when forecasting April 2026 on March 7, we don't yet know what March 2026's price will be — it's still in the future! So the service does this:

**Pass 1: Forecast month+1 (April 2026)**
```python
# Use actual December 2025 price as price_lag_1m
exog_m1 = [
  0,          # is_maha_season: April = Yala (0)
  1589.33,    # price_lag_12m: April 2025 actual price (from history)
  1651.71,    # price_lag_1m: December 2025 actual price (most recent)
  581911      # total_production_bags: December 2025 PSS production
]

# SARIMAX model returns
predicted_price_m1 = 1628.51 LKR per bag
confidence_interval_95 = [1591.86, 1670.84]  # There's a 95% chance the true price will fall in this range
```

**Pass 2: Forecast month+2 (May 2026)**
```python
# Use the April 2026 PREDICTION (1628.51) as price_lag_1m
# This is why it's called "two-pass" — month+2 uses month+1's forecast, not actual
exog_m2 = [
  0,          # is_maha_season: May = Yala (0)
  1612.45,    # price_lag_12m: May 2025 actual price (from history)
  1628.51,    # price_lag_1m: April 2026 PREDICTED price (from pass 1)
  581911      # total_production_bags: still using latest actual (Dec 2025)
]

# SARIMAX model returns
predicted_price_m2 = 1635.77 LKR per bag
confidence_interval_95 = [1593.22, 1678.32]
```

**Why this matters**: If the service naively used December 2025 actual price for both forecasts, the month+2 prediction would be systematically biased because it ignores the expected price change in month+1. The two-pass approach chains predictions correctly and is validated in the training notebook under "leakage-free rolling origin" evaluation.

**Accuracy metrics** (from `price_sarimax_meta.json`):
```json
{
  "month_plus_1_mape": 1.164,  // Mean Absolute Percentage Error: 1.16% off on average
  "month_plus_2_mape": 1.353,  // 1.35% off for month+2
  "month_plus_1_rmse": 21.8,   // Average error is ±21.8 LKR per bag
  "month_plus_2_rmse": 25.18,  // Month+2 error is ±25.18 LKR per bag
  "directional_accuracy_pct": 46.3  // Can predict "up or down" correctly only 46.3% of the time
}
```

**Understanding MAPE**: 1.164% error means if the actual price is 1650 LKR, the model typically predicts within 1.164% = ±19.20 LKR, so between 1630-1670 LKR. This is very accurate for price **level** estimation (what number the price will be).

**Understanding directional accuracy**: 46.3% is below random chance (50% coin flip). This means the model **cannot reliably predict whether the price will go UP or DOWN** next month. However, this is acceptable for harvest planning because:
- Landowners need the price level to calculate expected revenue: `revenue = bags × price`
- They don't need to know if next month will be higher than this month — they need to know the absolute LKR value
- Operations teams budget using the predicted price, not the direction of change

**95% Confidence Interval**: The interval [1591.86, 1670.84] for month+1 means: "Given the model's past accuracy and current market conditions, there's a 95% probability the true April 2026 price will land between 1591 and 1671 LKR per bag." The width of this interval (~79 LKR) reflects uncertainty. A wider interval (e.g., 150+ LKR spread) indicates the model is very uncertain (often happens when the model is stale or training data has a gap).

**Step 7: Response returned to landowner dashboard**

The compass-ml-service assembles the demand and price forecasts into a single JSON response and returns it to the API Gateway, which forwards it to the frontend. Complete response (annotated):

```json
{
  "model_version": "price_sarimax_v1.0",  // Price model version (demand has no version — it's a formula)
  "requested_at": "2026-03-07T10:15:32.445Z",  // Timestamp when forecast was generated (UTC)
  "forecast_date": "2026-03-07",  // The reference date (today, or the date passed in request)
  "last_price_data_date": "2025-12-01",  // Most recent month with actual price data in training set
  "data_gap_months": 3,  // Months between last_price_data_date and today (3 = Dec to Mar)
                          // If this exceeds 2, model may be stale — retrain recommended
  "forecasts": [
    {
      "month": "2026-04",  // Target month (month+1 from forecast_date)
      "horizon_months": 1,  // How many months ahead (1 = next month)
      "demand": {
        "predicted_bags": 8,  // THIS LANDOWNER's expected demand (integer, rounded from 8.4778)
        "method": "production_yield_ratio",  // Algorithm used (always this value)
        "production_source": "crystallization_onnx_service",  // Where production forecast came from
        "production_forecast_bags": 97.00,  // Input production (from ONNX LSTM model)
        "yield_ratio_used": 0.0874,  // The season-specific ratio applied
        "yield_ratio_season": "Yala",  // Season for this month (Apr-Sep = Yala)
        "yield_ratio_sample_months": 0,  // Count of live farm records used to compute ratio
                                          // 0 = using regional fallback, >0 = using live data
        "yield_ratio_source": "regional_historical_fallback"  // Indicates data source
                                          // "regional_historical_fallback" = Phase 1 (expected)
                                          // "live_mongodb" = Phase 2+ (after deals accumulate)
      },
      "price": {
        "predicted_lkr_per_bag": 1628.51,  // Market-wide wholesale price prediction
        "lower_95": 1591.86,  // Lower bound of 95% confidence interval
        "upper_95": 1670.84,  // Upper bound of 95% confidence interval
                               // Interpretation: 95% chance true price is between 1591-1671 LKR
        "model": "SARIMAX",  // Model type (always SARIMAX for price)
        "expected_mape_pct": 1.164  // Historical accuracy metric: model is off by 1.164% on average
                                     // For 1628 LKR: ±1.164% = ±19 LKR typical error
      }
    },
    {
      "month": "2026-05",  // month+2
      "horizon_months": 2,
      "demand": {
        "predicted_bags": 9,  // Slightly higher production in May → higher demand
        "method": "production_yield_ratio",
        "production_source": "crystallization_onnx_service",
        "production_forecast_bags": 103.50,
        "yield_ratio_used": 0.0874,  // Same Yala ratio (May is still Yala season)
        "yield_ratio_season": "Yala",
        "yield_ratio_sample_months": 0,
        "yield_ratio_source": "regional_historical_fallback"
      },
      "price": {
        "predicted_lkr_per_bag": 1635.77,  // Slightly higher than April (model detects upward trend)
        "lower_95": 1593.22,
        "upper_95": 1678.32,  // Wider interval for month+2 (more uncertainty)
        "model": "SARIMAX",
        "expected_mape_pct": 1.353  // Month+2 is slightly less accurate (1.35% vs 1.16%)
      }
    }
  ],
  "warnings": [
    "Demand yield ratio using regional Puttalam historical data (Maha=0.1027, Yala=0.0874, Transition=0.0951). Platform will switch to live farm data automatically once deal history accumulates.",
    "MongoDB price history collection unavailable or empty. Using price_sarimax_history.pkl as fallback."
  ]
}
```

**What each warning means**:

1. **"Demand yield ratio using regional..."**: Informational, not an error. Indicates the service is in Phase 1 mode. The forecast is still accurate — it's using validated PSS historical averages. No action required unless you want to accelerate to Phase 2 (requires 6+ months of live deal data).

2. **"MongoDB price history collection unavailable..."**: Expected in Phase 1. The `saltpricehistories` collection hasn't been created yet. The service falls back to the pre-trained price history stored in `price_sarimax_history.pkl` (the same 168 months used for training). This is the correct behavior until live deals start populating price data in MongoDB. The prediction accuracy is identical to using MongoDB — the warning just informs you which data source was used.

Neither warning indicates a failure. The forecast is fully functional.

---

## The Two Algorithms Explained Separately

### Algorithm 1: Demand Forecasting

The demand forecast is fundamentally per-landowner, not a PSS aggregate total, and this distinction is critical to understanding how the system scales. When a landowner with 25 beds receives a forecast of "8 bags demand in April 2026," that number represents the expected deals (distributor purchases) for their specific portion of the facility, not the entire Puttalam Salt Society's ~58,000 bags/month regional demand. The algorithm works by first receiving the landowner's production forecast — which has already been scaled down from the facility-wide total by the ratio of their beds to the total 7500 beds — and then applying a season-specific yield ratio that converts production into demand. The yield ratio concept addresses the real-world gap between how much salt crystallizes and how much actually gets sold through the digital deals marketplace within the same month. Historically across the PSS, approximately 8.74% of Yala season production becomes immediate demand (active deals closed within that month), while Maha season sees a higher 10.27% because distributors prefer the superior crystal quality produced during the wet season and book contracts more aggressively. This means not all production immediately converts to sales — some goes to government bulk contracts, some is stored for spot sales in later months, and some fulfills pre-negotiated long-term agreements that aren't tracked in the deals system yet. The seasonal variation in the ratio is driven by distributor buying psychology and market timing: during Maha (October-March), retail demand peaks before holidays, monsoon logistics favor advance booking, and quality premiums justify higher prices, so distributors act faster; during Yala (April-September), the market is slower, stockpiles are high from Maha surplus, and distributors wait for spot opportunities, reducing the yield ratio. The algorithm currently uses regional historical fallback ratios derived from 168 months of PSS aggregate data across all farms (2012-2025 government dataset), which is why every landowner sees the same 0.0874 or 0.1027 ratio for now. As the platform matures and individual landowners accumulate 6-12 months of closed deal history in the `deals` collection, the service will automatically transition to computing farm-specific ratios by averaging `demand_kg / production_volume` for that landowner's past 36 months, at which point a landowner who consistently negotiates early contracts might show a Yala ratio of 0.11 while a landowner who primarily stores for spot sales might show 0.06. This transition happens without code changes — the `forecast_demand()` function queries MongoDB for `demand_kg`, and if it finds data, it uses it; if not, it falls back to regional constants. The accuracy of the demand forecast in Phase 1 is approximately 10% error when validated against held-out PSS historical data, which is acceptable for harvest planning because the primary use case is workforce allocation (hire 3 workers vs 8 workers) and distributor meeting scheduling, not precise revenue calculation. The error will decrease in Phase 2 when farm-specific ratios replace the regional proxy, particularly for landowners whose operational patterns deviate from the PSS mean.

### Algorithm 2: Price Forecasting

The price forecast is market-wide, not farm-specific, because wholesale salt prices in the Puttalam region are set by supply-demand equilibrium across all PSS landowners selling to the same pool of distributors — individual landowners are price-takers in a competitive market, so their behavior does not move the price. The SARIMAX model captures three types of patterns in the 168-month training data: seasonal patterns (prices rise 3-5% in November-December due to pre-holiday retail demand and drop in June-July during monsoon when logistics costs are high and quality variance increases), recent momentum (if prices have been climbing for 3 consecutive months, the model expects continuation unless production volume spikes or season changes), and production volume sensitivity (when PSS facility-wide production jumps above 600,000 bags/month, prices tend to soften by 1-2% as supply floods the market, and when production falls below 550,000 bags/month, scarcity drives prices up). The model ingests four features at runtime: a binary season flag (Maha=1, Yala=0) that captures the quality premium and demand timing effects, the price from 12 months ago (same month last year) which anchors the seasonal baseline, the most recent month's actual price which captures short-term momentum and market sentiment, and the latest PSS total production volume which signals supply pressure. The two-pass forecasting process is essential for month+2 accuracy because true recursive forecasting requires chaining predictions — when forecasting May 2026 on March 7, the model needs April 2026's price as an input, but April is still in the future, so the service first predicts April (pass 1) using December 2025's actual price, then feeds that April prediction into the May forecast (pass 2) as if it were "last month's actual price." This leakage-free approach was validated during training using rolling-origin cross-validation where each historical month was forecast using only data available before that month, ensuring the 1.16% MAPE metric represents realistic out-of-sample accuracy. The low directional accuracy (46.3%, below coin-flip) occurs because salt markets exhibit mean-reverting behavior — prices oscillate around a seasonal average, so consecutive months often move in opposite directions (up one month, down the next), which confuses momentum-based direction prediction even though the absolute price level stays within a tight band. For operational use cases, this distinction is critical: a procurement team budgeting for Q2 needs to know "April will be ~1628 LKR/bag" (price level), not "April will be higher than March" (direction), and the SARIMAX model excels at the former despite failing at the latter. The model will improve continuously as live deal data accrues in Phase 3 (12+ months after launch), at which point retraining with the platform's own `pricePerKilo` averages from the `deals` collection will replace the government dataset and capture emerging market dynamics like new distributor entry, policy changes in government procurement, or shifts in export demand that weren't present in the 2012-2025 training window.

---

## Data Sources

### What Data Is Used Right Now (Phase 1)

| Data | Source | Collection/File | Freshness |
|------|--------|----------------|-----------|
| Sensor readings (8 parameters) | PSS field staff manual entry | `dailymeasurements` (MongoDB) | Updated daily by PSS staff; service fetches latest automatically |
| Production forecast (landowner-specific) | ONNX LSTM model (Component 1) | Computed on-demand via gRPC from `crystallization-onnx-service` | Fresh each call; based on latest sensor reading |
| Demand yield ratio (Maha/Yala) | Hardcoded PSS historical averages | Constants in `mongo_client.py` (0.1027, 0.0874) | Static; derived from 168-month PSS dataset (2012-2025) |
| Price history (168 months) | Pre-trained model artifact | `price_sarimax_history.pkl` (volume mount) | Last updated: 2025-12-01 (see `price_sarimax_meta.json`) |
| Price model (SARIMAX) | Pre-trained statsmodels object | `price_sarimax.pkl` (volume mount) | Version `price_sarimax_v1.0`, trained 2026-03-04 20:19:43 |
| Landowner bed counts | Database query | `landownermonthlyproductionpredictions.numberOfBeds` | Written by crystallization-service each prediction |
| Season classifications | Computed from month number | N/A (algorithmic: Oct-Mar=Maha, Apr-Sep=Yala) | Always current |

**Critical volume mount** (defined in `docker-compose.yml`):
```yaml
volumes:
  - ./apps/compass-ml-service/models:/app/models:ro
```

The `:ro` (read-only) flag ensures the service cannot accidentally overwrite model files at runtime. To update models, replace the files in `apps/compass-ml-service/models/` on the host and restart the container.

### How Data Improves Over Time

**Phase 1: Launch → 6 Months (Current State)**

The service is fully operational using regional PSS data as a fallback. Landowner-specific forecasts are accurate because the production component (from ONNX) is already personalized by bed count, and the yield ratio, while regional, was validated across 168 months of diverse conditions. Price forecasts are market-wide by design, so using the December 2025 endpoint for training data is correct — there's no "farm-specific wholesale price" to discover. The warnings in the API response (`"regional_historical_fallback"`, `"Using price_sarimax_history.pkl"`) are informational, not errors, and can be safely displayed to landowners as "Your forecast uses regional averages while the platform builds farm-specific history." During this phase, focus on data quality: ensure PSS staff enter daily sensor readings consistently (missing or stale readings will cause the ONNX model to return low production forecasts, which cascade into unrealistically low demand).

**Phase 2: 6+ Months of Live Operation**

Once 6-9 months of deal data have accumulated, a scheduled aggregation job (not yet implemented, estimated 50 lines of Python) should run monthly to compute `demand_kg` for each landowner and write it back to `ActualMonthlyProduction`. The aggregation logic:

```python
# Pseudo-code for monthly aggregation (to be scheduled as a cron job or Kafka consumer)
for each landowner in database:
    for each month in (last 36 months):
        closed_deals = query deals collection WHERE:
            landownerId = this_landowner
            status = "CLOSED"
            acceptedAt BETWEEN month_start AND month_end
        
        total_demand_kg = SUM(closed_deals.quantity)
        avg_price_lkr_per_kg = AVG(closed_deals.pricePerKilo)
        
        update ActualMonthlyProduction SET:
            demand_kg = total_demand_kg
            price_mean_lkr_per_kg = avg_price_lkr_per_kg
        WHERE:
            landownerId = this_landowner
            month = this_month
```

Once `demand_kg` exists in at least 12-18 months of documents, the `mongo_client.get_yield_ratio_history()` function automatically detects it and computes live ratios. The service transitions seamlessly — the `yield_ratio_source` field in the response changes from `"regional_historical_fallback"` to `"live_mongodb"`, and `yield_ratio_sample_months` becomes >0 (the count of records used). No code changes or restarts required. At this stage, landowners with highly consistent deal patterns (e.g., a landowner who pre-contracts 90% of production) will see custom ratios like 0.11-0.13 in Maha, while landowners who primarily sell spot will remain near the regional 0.087.

**Phase 3: 12+ Months of Live Price Data**

When the platform has 12-14 months of its own `pricePerKilo` data in the `deals` collection, retrain the SARIMAX model using the retraining notebook (located in the model development repository, not included in this deployment). The process:

1. Export `deals` data to CSV: `month, avg_price_per_kg, total_production_bags, is_maha_season`
2. Run `sarimax_price_model.py` in Google Colab or Jupyter, passing the new CSV
3. The notebook outputs three files: `price_sarimax.pkl`, `price_sarimax_history.pkl`, `price_sarimax_meta.json`
4. Replace the three files in `apps/compass-ml-service/models/` on the host machine
5. Restart compass-ml-service: `docker-compose restart compass-ml-service`
6. Verify `/api/v1/health` shows updated `sarimax_version` and `sarimax_last_data_date`

Retraining captures emerging patterns like new government pricing policy (e.g., subsidies introduced in 2027), shifts in export demand (Sri Lankan salt gains premium markets), or structural changes in distributor competition. Retrain monthly once you have 18+ months of live data, then quarterly once the model stabilizes. The `/api/v1/health` endpoint includes `data_gap_months` — if this exceeds 2, the model is stale (e.g., March 2027 but model was last trained on October 2026 data) and should be retrained immediately.

---

## Why Sensor Values Affect the Demand Forecast

The chain from physical salt pan conditions to the demand forecast displayed on a landowner's dashboard involves multiple transformations, and understanding this chain is critical for interpreting why entering accurate sensor data matters. Daily sensor readings describe the physical state of the shared PSS evaporation facility — brine depth, channel water levels, temperature — which are the raw material conditions that determine how much salt will crystallize over the next 30-60 days. High brine levels (IR_brine_level = 4-5 feet) combined with high channel water depth (East_channel, West_channel = 4-5 feet) indicate an optimally functioning facility: seawater is flowing in steadily, evaporation ponds are full of high-salinity brine, and crystallization beds have sufficient dissolved salt to produce thick crusts. Low readings (all sensors at 2.0 feet) describe a poorly performing or recently flushed facility where brine concentration is weak and water flow is restricted, which will crystallize minimal salt. The ONNX LSTM model was trained on years of paired data — (sensor readings on date X) → (actual production 30 days later) — so it learned that IR_brine_level=4.5 typically leads to 600+ bags/month facility-wide, while IR_brine_level=2.0 leads to <300 bags/month. When the crystallization-service queries the latest `dailymeasurements` document and finds all parameters at 2.0, it passes those values to the ONNX service, which returns a low facility-wide production forecast (e.g., 129,000 bags instead of the normal 291,000 bags). This facility total is then scaled down to the individual landowner's share by their bed ratio — suppose they own 25 beds out of 7500 facility total, their scaled production becomes 129,000 × (25/7500) = 43.02 bags. This landowner-specific production forecast is then sent to compass-ml-service, which multiplies it by the Yala yield ratio 0.0874 to get demand: 43.02 × 0.0874 = 3.76 bags, rounded to 4 bags. The landowner sees "4 bags expected demand for April 2026" on their dashboard. Contrast this with realistic sensor data (IR_brine_level=4.2, East_channel=4.0, water_temperature=32°C), which describes healthy facility conditions. The ONNX model interprets these values as favorable for crystallization and outputs a facility forecast of ~291,000 bags. The same 25-bed landowner receives 291,000 × (25/7500) = 97 bags scaled production, which becomes 97 × 0.0874 = 8.48 bags demand, displayed as 8 bags on the dashboard. Now notice: the demand doubled from 4 to 8 bags purely because sensor inputs changed — the yield ratio stayed fixed at 0.0874, the landowner's bed count stayed at 25, and the SARIMAX price model is completely unaffected by sensors (it only uses historical price trends). The difference in demand is entirely driven by the ONNX model's interpretation of physical salt pan conditions. If a landowner repeatedly sees unrealistically low demand forecasts (e.g., 3-5 bags when they historically produce 80-100 bags), the root cause is almost always stale or placeholder sensor data in the `dailymeasurements` collection. The fix: verify the latest sensor reading date matches today, and ensure PSS staff are entering real measured values, not test data like 2.0 across all fields. The price forecast remains unaffected by this issue because wholesale market prices are set by regional supply-demand equilibrium 14 years of price history, not by one landowner's daily brine depth. Even if a single landowner's sensors fail or their facility shuts down, the PSS market price stays stable because other landowners compensate. This architectural decision — sensors affect production/demand but not price — accurately models the real-world salt market structure where individual landowners are price-takers.

---

## MongoDB Collections

### dailymeasurements

**Purpose**: Stores PSS facility-wide daily sensor readings entered by field staff.

**Schema**:
```javascript
{
  _id: ObjectId,
  date: String,           // YYYY-MM-DD format, e.g., "2026-03-07"
  parameters: {
    water_temperature: Number,  // Celsius, range 25-40°C typical
    lagoon: Number,             // Depth in feet, 0-5 range
    OR_brine_level: Number,     // Outer Reservoir brine depth, feet
    OR_bund_level: Number,      // Outer Reservoir embankment height, feet
    IR_brine_level: Number,     // Inner Reservoir brine depth, feet (CRITICAL for production)
    IR_bound_level: Number,     // Inner Reservoir embankment height, feet
    East_channel: Number,       // Eastern channel water depth, feet
    West_channel: Number        // Western channel water depth, feet
  },
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Who reads it**: `crystallization-service` fetches the latest document (sorted by `date` DESC) when computing predictions.

**Who writes it**: API Gateway receives POST requests from PSS admin dashboard and writes via `crystallization-service.CreateDailyMeasurement()`.

**Sample document** (realistic production conditions):
```json
{
  "_id": "ObjectId(65f8a3c2d1234567890abcde)",
  "date": "2026-03-06",
  "parameters": {
    "water_temperature": 31.5,
    "lagoon": 3.2,
    "OR_brine_level": 4.0,
    "OR_bund_level": 4.5,
    "IR_brine_level": 4.3,
    "IR_bound_level": 4.8,
    "East_channel": 3.9,
    "West_channel": 3.7
  },
  "createdAt": "2026-03-06T06:45:00.000Z",
  "updatedAt": "2026-03-06T06:45:00.000Z"
}
```

**Critical note**: There should be exactly one document per date. Duplicate dates indicate a data quality issue. The ONNX model assumes readings are daily — gaps of 7+ days will cause forecast staleness warnings.

---

### landownermonthlyproductionpredictions

**Purpose**: Stores individual landowner production forecasts computed by the ONNX LSTM model, scaled to each landowner's bed count.

**Schema**:
```javascript
{
  _id: ObjectId,
  landownerId: ObjectId,        // Reference to users collection
  month: String,                 // YYYY-MM format, e.g., "2026-04"
  productionForecast: Number,    // THIS LANDOWNER's predicted production in bags
  season: String,                // "Maha", "Yala", or "Transition"
  facilityProductionForecast: Number,  // PSS total across all 7500 beds (before scaling)
  numberOfBeds: Number,          // This landowner's bed count (e.g., 25)
  modelVersion: String,          // ONNX model identifier, e.g., "crystallization_lstm_v2.1"
  predictionDate: ISODate,       // When this prediction was computed
  basedOnSensorDate: String,     // YYYY-MM-DD of the sensor reading used
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Who reads it**: API Gateway queries this collection via `crystallization-service.GetPredictedMonthlyProduction()` to fetch landowner-specific forecasts before calling compass-ml-service.

**Who writes it**: `crystallization-service` writes after receiving ONNX prediction and scaling by bed ratio.

**Sample document**:
```json
{
  "_id": "ObjectId(65f8a5c7d1234567890abcdf)",
  "landownerId": "ObjectId(65d3a1b2c3d4e5f6a7b8c9d0)",
  "month": "2026-04",
  "productionForecast": 97.00,
  "season": "Yala",
  "facilityProductionForecast": 291000.0,
  "numberOfBeds": 25,
  "modelVersion": "crystallization_lstm_v2.1",
  "predictionDate": "2026-03-07T10:15:32.445Z",
  "basedOnSensorDate": "2026-03-06",
  "createdAt": "2026-03-07T10:15:32.445Z",
  "updatedAt": "2026-03-07T10:15:32.445Z"
}
```

**Indexing recommendation**: Create compound index on `(landownerId, month)` for fast lookups.

---

### ActualMonthlyProduction

**Purpose**: Records historical production actuals for each landowner after month-end. Currently contains only production volume and season; will be extended with `demand_kg` in Phase 2.

**Schema** (current, Phase 1):
```javascript
{
  _id: ObjectId,
  landownerId: ObjectId,
  month: String,              // YYYY-MM format
  production_volume: Number,  // Actual bags produced (verified after harvest)
  season: String,             // "Maha" or "Yala"
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Schema** (future, Phase 2 after aggregation job runs):
```javascript
{
  _id: ObjectId,
  landownerId: ObjectId,
  month: String,
  production_volume: Number,
  demand_kg: Number,              // NEW: Total closed deals quantity for this month
  price_mean_lkr_per_kg: Number,  // NEW: Average pricePerKilo from closed deals
  season: String,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

**Who reads it**: `compass-ml-service` via `MongoClient.get_yield_ratio_history()` to compute live yield ratios (Phase 2+).

**Who writes it**: Manual entry or batch import currently. In Phase 2, a monthly aggregation job computes `demand_kg` from the `deals` collection and updates existing documents.

**Sample document** (Phase 1, current):
```json
{
  "_id": "ObjectId(65e4a3c2d1234567890abce0)",
  "landownerId": "ObjectId(65d3a1b2c3d4e5f6a7b8c9d0)",
  "month": "2025-11",
  "production_volume": 20753.8,
  "season": "Maha",
  "createdAt": "2025-12-01T00:00:00.000Z",
  "updatedAt": "2025-12-01T00:00:00.000Z"
}
```

**Sample document** (Phase 2, future):
```json
{
  "_id": "ObjectId(65e4a3c2d1234567890abce0)",
  "landownerId": "ObjectId(65d3a1b2c3d4e5f6a7b8c9d0)",
  "month": "2026-03",
  "production_volume": 22150.0,
  "demand_kg": 2280.5,
  "price_mean_lkr_per_kg": 151.2,
  "season": "Maha",
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-05T03:22:15.000Z"
}
```

**Migration path**: See [SCHEMA_MIGRATION.md](SCHEMA_MIGRATION.md) for the aggregation query.

---

### pricepredictions

**Purpose**: Write-only collection that stores every price forecast generated by compass-ml-service for audit trail and model performance monitoring.

**Schema**:
```javascript
{
  _id: ObjectId,
  forecast_date: String,        // YYYY-MM-DD when forecast was requested
  month: String,                // YYYY-MM target month being forecast
  horizon_months: Number,       // 1 or 2 (month+1 or month+2)
  predicted_lkr_per_bag: Number,
  lower_95: Number,             // Lower bound of 95% confidence interval
  upper_95: Number,             // Upper bound of 95% confidence interval
  model_version: String,        // e.g., "price_sarimax_v1.0"
  expected_mape_pct: Number,    // Historical MAPE for this horizon
  created_at: ISODate
}
```

**Who reads it**: No service reads this at runtime. Intended for offline analysis (e.g., compare predicted prices to actual market prices 2 months later to validate model accuracy).

**Who writes it**: `compass-ml-service` writes 2 documents per forecast call (one for month+1, one for month+2) via `MongoClient.write_price_prediction()`. Failures are logged but non-fatal — the API response is returned even if writes fail.

**Sample document**:
```json
{
  "_id": "ObjectId(65f8a7c2d1234567890abce3)",
  "forecast_date": "2026-03-07",
  "month": "2026-04",
  "horizon_months": 1,
  "predicted_lkr_per_bag": 1628.51,
  "lower_95": 1591.86,
  "upper_95": 1670.84,
  "model_version": "price_sarimax_v1.0",
  "expected_mape_pct": 1.164,
  "created_at": "2026-03-07T10:15:32.567Z"
}
```

**Analytics use case**: After 3-6 months, run a validation query:
```javascript
// Compare predictions against actual market prices
db.pricepredictions.aggregate([
  { $match: { horizon_months: 1 } },
  { $lookup: {
      from: "saltpricehistories",  // Assumes this collection exists in Phase 3
      localField: "month",
      foreignField: "month",
      as: "actual"
  }},
  { $project: {
      month: 1,
      predicted: "$predicted_lkr_per_bag",
      actual: { $arrayElemAt: ["$actual.price_mean", 0] },
      error: { $abs: { $subtract: [
        "$predicted_lkr_per_bag",
        { $arrayElemAt: ["$actual.price_mean", 0] }
      ]} }
  }}
])
```

---

## API Reference

### POST /api/v1/demand-price-forecast

Compute demand and price forecasts for the next 2 months based on provided production forecasts.

**Authentication**: Not directly enforced at this service level. The API Gateway (which calls this endpoint) enforces JWT Bearer token authentication and extracts `landowner_id`. This service trusts that the API Gateway has already validated the caller.

**Request Body**:
```json
{
  "forecast_date": "2026-03-07",           // Optional. YYYY-MM-DD. Defaults to today if omitted.
  "production_forecast_m1": 97.00,         // Required. Bags for month+1. Must be > 0.
  "production_forecast_m2": 103.50,        // Required. Bags for month+2. Must be > 0.
  "production_month_m1": "2026-04",        // Required. YYYY-MM. Must match month+1 from forecast_date.
  "production_month_m2": "2026-05",        // Required. YYYY-MM. Must match month+2 from forecast_date.
  "season_m1": "Yala",                     // Optional. "Maha", "Yala", or "Transition". If omitted, computed from month.
  "season_m2": "Yala"                      // Optional. Same as above.
}
```

**Field Descriptions**:

- `forecast_date`: The reference date for the forecast. Month+1 and month+2 are calculated relative to this date. If you want to simulate a forecast "as if it were run on 2026-02-15," pass that date here. Defaults to today's date if omitted.

- `production_forecast_m1`: The landowner-specific production forecast in bags for month+1. This value should come from the crystallization-onnx-service (ONNX LSTM model) and must already be scaled to the landowner's bed count. Cannot be zero or negative.

- `production_forecast_m2`: Same as above, for month+2.

- `production_month_m1`: The target month being forecast, in YYYY-MM format. The service validates that this matches month+1 calculated from `forecast_date`. If there's a mismatch, a warning is added to the response but the forecast proceeds.

- `production_month_m2`: Target month for horizon 2.

- `season_m1`, `season_m2`: Season classification for the target months. If provided, the demand algorithm uses these values instead of computing season from the month number. This ensures consistency with the ONNX model's internal season encoding. Allowed values: `"Maha"` (Oct-Mar), `"Yala"` (Apr-Sep), `"Transition"` (edge cases, uses average ratio).

**Response** (HTTP 200):
```json
{
  "model_version": "price_sarimax_v1.0",
  "requested_at": "2026-03-07T10:15:32.445Z",
  "forecast_date": "2026-03-07",
  "last_price_data_date": "2025-12-01",
  "data_gap_months": 3,
  "forecasts": [
    {
      "month": "2026-04",
      "horizon_months": 1,
      "demand": {
        "predicted_bags": 8,
        "method": "production_yield_ratio",
        "production_source": "crystallization_onnx_service",
        "production_forecast_bags": 97.00,
        "yield_ratio_used": 0.0874,
        "yield_ratio_season": "Yala",
        "yield_ratio_sample_months": 0,
        "yield_ratio_source": "regional_historical_fallback"
      },
      "price": {
        "predicted_lkr_per_bag": 1628.51,
        "lower_95": 1591.86,
        "upper_95": 1670.84,
        "model": "SARIMAX",
        "expected_mape_pct": 1.164
      }
    },
    {
      "month": "2026-05",
      "horizon_months": 2,
      "demand": { /* same structure */ },
      "price": { /* same structure */ }
    }
  ],
  "warnings": [
    "Demand yield ratio using regional Puttalam historical data...",
    "MongoDB price history collection unavailable or empty..."
  ]
}
```

**Field Descriptions** (see Step 7 in "How a Landowner Gets Their Forecast" for complete annotations).

**Error Responses**:

**HTTP 422 Unprocessable Entity**:
```json
{
  "detail": [
    {
      "loc": ["body", "production_forecast_m1"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error.number.not_gt"
    }
  ]
}
```

**Cause**: Request body fails validation. Common issues:
- `production_forecast_m1` or `production_forecast_m2` is zero, negative, or missing
- `production_month_m1` does not match YYYY-MM pattern
- `forecast_date` does not match YYYY-MM-DD pattern

**Fix**: Validate input before calling. The API Gateway should never send invalid data if using the correct DTOs.

**HTTP 503 Service Unavailable**:
```json
{
  "detail": "SARIMAX model not loaded."
}
```

**Cause**: The service could not load `price_sarimax.pkl` at startup. Check Docker logs for file path errors.

**Fix**:
```bash
# Verify model files exist in the volume mount
docker exec compass-ml-service ls -lh /app/models
# Should show: price_sarimax.pkl, price_sarimax_history.pkl, price_sarimax_meta.json

# If missing, ensure docker-compose.yml has:
# volumes:
#   - ./apps/compass-ml-service/models:/app/models:ro

# Restart the service
docker-compose restart compass-ml-service
```

---

### GET /api/v1/health

Health check endpoint that reports service status and model metadata.

**Authentication**: None required (public endpoint).

**Response** (HTTP 200):
```json
{
  "status": "ok",
  "sarimax_model_loaded": true,
  "sarimax_version": "price_sarimax_v1.0",
  "sarimax_last_data_date": "2025-12-01",
  "data_gap_months": 3,
  "mongodb_connected": true
}
```

**Field Descriptions**:

- `status`: Overall health status. One of:
  - `"ok"`: All systems operational (model loaded, MongoDB reachable, data gap ≤ 2 months)
  - `"degraded"`: Model loaded but MongoDB unreachable, or data gap > 2 months
  - `"unhealthy"`: SARIMAX model failed to load (service unusable)

- `sarimax_model_loaded`: Boolean. If `false`, price forecasting will fail.

- `sarimax_version`: Model identifier from `price_sarimax_meta.json`. Format: `price_sarimax_v{major}.{minor}`.

- `sarimax_last_data_date`: Last month included in the training dataset (YYYY-MM-DD, always the 1st of the month). If this is more than 2 months ago, the model is stale and should be retrained.

- `data_gap_months`: Calculated as `(today's year - last_data_year) × 12 + (today's month - last_data_month)`. Example: If today is 2026-03-07 and `sarimax_last_data_date` is 2025-12-01, gap = 3 months. Alert if > 2.

- `mongodb_connected`: Boolean. If `false`, demand forecasts will fall back to regional ratios (expected in Phase 1) and price forecasts will use pkl fallback (also expected). The service remains operational but cannot incorporate live data.

**Response** (HTTP 503 if unhealthy):
```json
{
  "status": "unhealthy",
  "sarimax_model_loaded": false,
  "sarimax_version": null,
  "sarimax_last_data_date": null,
  "data_gap_months": null,
  "mongodb_connected": false
}
```

**Monitoring Recommendation**: Set up automated alerts:
- Alert if `status != "ok"` for > 5 minutes
- Critical alert if `sarimax_model_loaded == false`
- Warning alert if `data_gap_months > 2`
- Info alert if `mongodb_connected == false` (expected in Phase 1, investigate in Phase 2+)

**Docker Compose Health Check**:

The `docker-compose.yml` includes:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8002/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 20s
```

Docker will mark the container as "unhealthy" if `/api/v1/health` returns HTTP 503 or times out after 3 retries. Other services (like `compass-service`) can depend on `compass-ml-service` being healthy before starting.

---

## Model Files

The service requires three files in the `MODEL_DIR` directory (default: `/app/models`, mounted from `./apps/compass-ml-service/models` on the host).

### price_sarimax.pkl

**Contents**: A serialized `statsmodels.tsa.statespace.sarimax.SARIMAXResultsWrapper` object (Python pickle format). This is the trained SARIMAX model weights, including coefficients, residuals, and forecast state.

**File size**: ~500 KB (depends on training data length).

**Last updated**: 2026-03-04 20:19:43 UTC (see `price_sarimax_meta.json` → `training_date`).

**When to retrain**: 
- **Immediate**: If `data_gap_months` (from `/api/v1/health`) exceeds 2.
- **Scheduled**: Monthly once 18+ months of live `pricePerKilo` data exists in the `deals` collection.
- **Event-driven**: After significant market change (e.g., government introduces salt price subsidy, PSS expands to new export markets, major competitor enters the region).

**How to retrain**:
1. Export live price history from `deals` collection or `saltpricehistories` (Phase 3) to CSV:
   ```csv
   month,price_mean,total_production_bags,is_maha_season
   2025-01,1620.50,582000,1
   2025-02,1635.20,575000,1
   ...
   ```

2. Run the retraining notebook (location: model development repo, not in this deployment):
   ```bash
   # In Google Colab or local Jupyter
   python sarimax_price_model.py --input prices.csv --output ./models/
   ```

3. The script outputs three files. Copy them to the host machine:
   ```bash
   scp price_sarimax.pkl user@server:/path/to/apps/compass-ml-service/models/
   scp price_sarimax_history.pkl user@server:/path/to/apps/compass-ml-service/models/
   scp price_sarimax_meta.json user@server:/path/to/apps/compass-ml-service/models/
   ```

4. Restart the service (the files are mounted read-only, so the service cannot auto-reload):
   ```bash
   docker-compose restart compass-ml-service
   ```

5. Verify the new version is loaded:
   ```bash
   curl http://localhost:8002/api/v1/health | jq '.sarimax_version, .sarimax_last_data_date'
   # Should show updated training_date
   ```

**Critical**: Never manually edit this file — it's a binary pickle and will corrupt if modified. Always generate via the training script.

---

### price_sarimax_history.pkl

**Contents**: A pandas DataFrame with columns `['date', 'price_mean', 'total_production_bags', 'is_maha_season']`, representing the last 13 months of price/production history used for lag lookups during inference.

**File size**: ~15 KB.

**Why 13 months?** The SARIMAX model needs `price_lag_12m` (same month last year). To forecast April 2026, the service needs April 2025 price. The extra 1 month provides `price_lag_1m` (most recent actual price). So 12 + 1 = 13 rows.

**Last updated**: Same as `price_sarimax.pkl` (both are regenerated together during retraining).

**Structure**:
```python
import pandas as pd

df = pd.read_pickle("price_sarimax_history.pkl")
print(df.tail())
#         date  price_mean  total_production_bags  is_maha_season
# 2025-12-01     1651.71               581911.0               1
# 2025-11-01     1642.30               590200.0               1
# ...
```

**Fallback behavior**: If MongoDB's `saltpricehistories` collection is unavailable or has < 13 records, the service uses this pkl file as a fallback. This is expected in Phase 1. A warning is added to the API response:
```
"MongoDB price history collection unavailable or empty. Using price_sarimax_history.pkl as fallback."
```

The prediction accuracy is identical whether using MongoDB or pkl — they contain the same data in Phase 1.

---

### price_sarimax_meta.json

**Contents**: Metadata about the trained model, including version, performance metrics, and inference notes.

**File size**: ~1 KB.

**Structure**:
```json
{
  "version": "price_sarimax_v1.0",
  "model_order": [1, 1, 1],
  "seasonal_order": [0, 1, 1, 12],
  "exog_cols": [
    "is_maha_season",
    "price_lag_12m",
    "price_lag_1m",
    "total_production_bags"
  ],
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
  "inference_notes": {
    "price_lag_1m_month_plus_1": "use last known actual price from MongoDB",
    "price_lag_1m_month_plus_2": "use month+1 PREDICTION — service handles this automatically",
    "price_lag_12m": "look up price from 12 months ago in MongoDB history",
    "total_production_bags": "use latest available from MongoDB ActualMonthlyProduction",
    "is_maha_season": "derived from forecast month: 1 if month in [10,11,12,1,2,3]"
  },
  "artifacts": {
    "model": "price_sarimax.pkl",
    "history": "price_sarimax_history.pkl",
    "meta": "price_sarimax_meta.json"
  }
}
```

**How the service uses this file**:
- On startup: Logs `version` and `last_data_date` to console
- In `/api/v1/health`: Returns `sarimax_version`, `sarimax_last_data_date`, `data_gap_months`
- In forecast response: Includes `model_version` and `expected_mape_pct` fields

**Critical field: `exog_cols`**: The service builds the exogenous feature array using `_build_exog_row()` in `forecast.py`. The order MUST match this array exactly:
```python
# forecast.py line ~220
exog = [
    is_maha_season,           # Position 0
    price_lag_12m,            # Position 1
    price_lag_1m,             # Position 2
    total_production_bags     # Position 3
]
```

If you retrain the model with different features or reorder them, update this function and the meta.json simultaneously, or predictions will be nonsense.

---

## Known Limitations

### 1. Shared Facility Sensors — All Landowners Use Same Readings

The current system uses facility-wide sensor readings from the central PSS evaporation ponds, not individual landowner plot measurements. When PSS field staff enter `dailymeasurements` (IR_brine_level, East_channel, etc.), those values describe the shared infrastructure that serves all ~300 landowners. This means if Landowner A and Landowner B both request forecasts on the same day, they receive production estimates based on identical sensor inputs — the difference in their forecasts comes solely from their bed count ratio (e.g., 25 beds vs 40 beds). In reality, micro-level conditions vary: Landowner A's crystallization beds might have better sun exposure, leading to 5-10% higher yield than Landowner B despite identical facility-wide brine levels. The ONNX model cannot capture plot-specific variations because it was trained on facility-aggregated data. **Why this is acceptable for MVP**: The Puttalam Salt Society operates a shared evaporation system where all landowners' beds draw from the same brine reservoirs and channel network. Individual plot conditions vary within ±10% of the facility mean, which is smaller than the ONNX model's inherent RMSE (~12%). Plot-level sensors (individual brine samplers, localized temperature probes) were considered but rejected due to cost (300 landowners × 8 sensors × 50 USD = 120,000 USD capital expenditure) and maintenance complexity (daily calibration by field staff increases labor 3x). **What changes when individual monitoring becomes feasible**: If IoT sensor deployment becomes viable (e.g., subsidized by government digitalization grants), the architecture supports it: the `GetPredictions` gRPC call already includes a `landowner_id` parameter. The crystallization-service could query a `landownersensorreadings` collection instead of the shared `dailymeasurements`, and the ONNX service could be retrained on landowner-specific paired data (sensor_readings_plot_A → production_plot_A). No changes required in compass-ml-service — it receives the same `production_forecast_m1` input regardless of how it was computed.

### 2. Demand Yield Ratio Is Regional Proxy

The yield ratio (0.1027 for Maha, 0.0874 for Yala) currently represents PSS aggregate historical averages across 168 months of regional data, not this specific farm's actual selling behavior. This introduces systematic error for landowners whose deal patterns deviate from the PSS mean. For example, a landowner who pre-contracts 90% of production with a single distributor in advance (high commitment, low spot sales) might have an actual yield ratio of 0.15 in Maha, while a landowner who prefers spot market flexibility (storing salt for 2-3 months before selling) might have a ratio of 0.06. The current algorithm treats both landowners identically, overestimating demand for the spot-seller and underestimating for the contract-seller. **What changes when live deals accumulate**: Once the `deals` collection contains 6-9 months of CLOSED status records for a landowner, the monthly aggregation job (Phase 2) computes `demand_kg` from actual transaction data and writes it to `ActualMonthlyProduction`. The service then calculates farm-specific ratios: `live_ratio = MEAN(demand_kg / production_volume) WHERE season = target_season AND month IN (last 36 months)`. The `yield_ratio_source` field in the response automatically transitions from `"regional_historical_fallback"` to `"live_mongodb"`, and `yield_ratio_sample_months` shows how many months of data contributed (e.g., 18 months for Maha, 18 months for Yala). At this point, the forecast becomes genuinely personalized, capturing the landowner's unique selling rhythm, distributor relationships, and seasonal inventory strategy. The transition requires no code changes or service updates — it's purely data-driven. Expected timeline: 6 months post-launch for first landowners, 12 months for 80% coverage (landowners who joined late or have irregular activity will remain on regional fallback longer).

### 3. Prediction Staleness — No Automated Refresh

The compass-ml-service computes forecasts on-demand when the API receives a request, but it does not automatically regenerate forecasts when new sensor data arrives. Scenario: PSS staff enter fresh `dailymeasurements` on March 7 at 6:00 AM (updated brine levels, new temperature readings). Landowner A views their dashboard at 6:05 AM and receives a forecast based on the latest data. Landowner B, who last viewed their dashboard at 11:00 PM on March 6, sees stale data in their cached frontend state until they refresh the page. The service itself always fetches the latest sensor reading from MongoDB, but if the frontend caches the forecast response for 24 hours (common optimization for reducing redundant API calls), users see outdated predictions. **Workaround for now**: The frontend should include a "Refresh Forecast" button that forces a new API call, bypassing the cache. Alternatively, cache forecasts for a maximum of 6 hours and display a timestamp: "Last updated: March 7, 2026 at 10:15 AM." **Long-term solution (not implemented)**: Hook into Kafka event stream. When `crystallization-service` emits a `DailyMeasurementCreated` event, a Kafka consumer in compass-ml-service could pre-compute forecasts for all active landowners and push updates to a Redis cache or send WebSocket notifications to online users. This requires +200 lines of Kafka consumer code and Redis integration (out of scope for MVP). For a 300-landowner system where sensor readings update once daily, manual refresh is acceptable — automated push is a scalability optimization for 1000+ landowners or real-time sensor networks.

### 4. Directional Price Accuracy Below Coin-Flip

The SARIMAX price model achieves 46.3% directional accuracy, meaning it predicts whether next month's price will be higher or lower than this month correctly only 46.3% of the time — worse than random guessing (50%). This happens because salt wholesale prices exhibit mean-reverting behavior around a seasonal baseline: if March's price spikes to 1680 LKR (above the seasonal average of 1650 LKR), April's price tends to revert downward toward the mean, but the SARIMAX model's autoregressive component interprets the March spike as momentum and predicts April will continue upward. The reversion happens because distributor demand is elastic — when prices rise above 1670 LKR, some distributors delay purchases or source from alternative regions (e.g., Hambantota), which softens demand and pulls prices back down. The model was trained on 168 months of price movements, but short-term direction is dominated by random shocks (sudden government procurement, unexpected monsoon delays, distributor inventory management decisions) that are not predictable from lagged price and production volume alone. **Why the service is still useful despite this limitation**: Harvest planning and revenue budgeting require absolute price levels ("Will April be ~1628 LKR or ~1450 LKR?"), not directional changes ("Will April be higher than March?"). A landowner deciding whether to hire 8 workers or 12 workers for harvest needs the expected revenue: `8 bags × 1628 LKR = 13,024 LKR`. Whether that's +20 LKR or −20 LKR from last month is irrelevant to the staffing decision. The 1.16% MAPE (±19 LKR typical error) is excellent for price level estimation, which is the actual operational need. Directional accuracy matters for speculative trading strategies (buy futures if expecting price increase), which is out of scope for this platform. **Monitoring recommendation**: Do NOT display directional indicators to landowners (e.g., don't show "↑ Price expected to rise" or "↓ Price expected to fall"). Display only the predicted price with confidence interval: "Expected price: 1628 LKR (range: 1591-1670 LKR)."

---

## Troubleshooting

### Problem 1: "fetch failed" — compass-service cannot reach compass-ml-service

**Symptoms**:
- API Gateway returns HTTP 400: `"Failed to fetch demand/price forecast: fetch failed"`
- compass-service logs show: `FetchError: request to http://compass-ml-service:8002/api/v1/demand-price-forecast failed`

**Cause**: Docker network issue. The `compass-service` container cannot resolve the DNS name `compass-ml-service` or the service is not running.

**Diagnosis**:
```bash
# Check if compass-ml-service is running
docker ps | grep compass-ml-service
# Should show: compass-ml-service   Up 5 minutes   8002/tcp

# If not running, check logs
docker logs compass-ml-service
```

**Fix**:
1. Verify both services are on the same Docker network:
   ```bash
   docker network inspect final-year-research-25-26j-431_app-network
   # Look for both "compass-service" and "compass-ml-service" in Containers
   ```

2. Restart the service:
   ```bash
   docker-compose restart compass-ml-service
   ```

3. If still failing, exec into compass-service and test reachability:
   ```bash
   docker exec -it compass-service sh
   curl http://compass-ml-service:8002/api/v1/health
   # Should return {"status":"ok",...}
   ```

4. Check `docker-compose.yml` environment variable:
   ```yaml
   compass-service:
     environment:
       - COMPASS_ML_SERVICE_URL=http://compass-ml-service:8002
   ```
   Ensure no trailing slash, protocol is `http` (not `https`), and port is 8002.

---

### Problem 2: Production forecast is very low (e.g., 43 bags for 25 beds)

**Symptoms**:
- Demand forecast shows 3-5 bags when landowner historically produces 80-100 bags
- All landowners see similarly depressed forecasts

**Cause**: Sensor values in `dailymeasurements` are placeholder/test data (all parameters at ~2.0), which the ONNX model interprets as a non-functional facility.

**Diagnosis**:
```bash
# Query latest sensor reading
docker exec -it compass-service mongosh "$MONGO_URI" --eval "
  db.dailymeasurements.find().sort({date:-1}).limit(1).pretty()
"

# Look for parameters like:
# IR_brine_level: 2.0
# East_channel: 2.0
# West_channel: 2.0
```

**Fix**:
1. Have PSS staff enter actual measured values via the admin dashboard:
   ```http
   POST /api/v1/crystallization/daily-measurements
   {
     "date": "2026-03-07",
     "waterTemperature": 31.5,
     "lagoon": 3.2,
     "orBrineLevel": 4.0,
     "irBrineLevel": 4.3,
     "eastChannel": 3.8,
     "westChannel": 3.5
   }
   ```

2. Verify the new reading was saved:
   ```bash
   docker exec -it compass-service mongosh "$MONGO_URI" --eval "
     db.dailymeasurements.find({date:'2026-03-07'}).pretty()
   "
   ```

3. Trigger new forecast by refreshing the landowner dashboard or calling the API again. Production should jump to realistic levels (~90-100 bags for a 25-bed landowner).

**Prevention**: Set up validation in the frontend to warn staff if all sensor values are exactly 2.0 (likely test data).

---

### Problem 3: Demand shows 0 or null

**Symptoms**:
- API response has `"predicted_bags": null` in the demand object
- Warnings include: `"Production forecast not available for this landowner"`

**Cause**: The `production_forecast_m1` or `production_forecast_m2` input was 0, null, or missing when compass-ml-service was called.

**Diagnosis**:
Trace back to the crystallization service:
```bash
# Check if landowner has production predictions
docker exec -it compass-service mongosh "$MONGO_URI" --eval "
  db.landownermonthlyproductionpredictions.find({
    landownerId: ObjectId('YOUR_LANDOWNER_ID'),
    month: {$in: ['2026-04', '2026-05']}
  }).pretty()
"
# Should return 2 documents with productionForecast > 0
```

**Fix**:
1. If no documents exist, the crystallization-service hasn't generated predictions yet. Trigger a manual prediction:
   ```http
   POST /api/v1/crystallization/predictions
   {
     "role": "LANDOWNER",
     "landowner_id": "YOUR_LANDOWNER_ID",
     "start_date": "2026-04-01",
     "forecast_days": 30
   }
   ```

2. If documents exist but `productionForecast` is 0, the ONNX model returned zero (likely due to test/invalid sensor data — see Problem 2).

3. If documents exist, check the API Gateway request to compass-ml-service in the logs:
   ```bash
   docker logs api-gateway | grep "production_forecast_m1"
   # Should show: production_forecast_m1: 97.00
   ```

4. If the request has null values, the API Gateway's gRPC call to crystallization-service failed. Check `crystallization-service` logs.

---

### Problem 4: Price confidence interval is very wide (>200 LKR spread)

**Symptoms**:
- `lower_95` = 1450 LKR, `upper_95` = 1680 LKR (spread = 230 LKR)
- Normal spread is 70-80 LKR

**Cause**: Model is stale (trained on data ending Dec 2025, but it's now June 2026, gap = 6 months), or training data has a structural break (e.g., government introduced price controls after the training period).

**Diagnosis**:
```bash
curl http://localhost:8002/api/v1/health | jq '.data_gap_months'
# If > 3, model is stale
```

**Fix**:
1. Retrain the SARIMAX model with recent data (see "Model Files" section).
2. Replace the three model files and restart:
   ```bash
   cp new_model_files/* apps/compass-ml-service/models/
   docker-compose restart compass-ml-service
   ```

3. Verify the new model is loaded:
   ```bash
   curl http://localhost:8002/api/v1/health | jq '.sarimax_last_data_date'
   # Should show recent date (within 1-2 months of today)
   ```

**Prevention**: Set up monthly retraining pipeline. Automate via cron job:
```bash
# crontab entry to retrain on the 5th of each month
0 2 5 * * python /path/to/sarimax_price_model.py && docker-compose restart compass-ml-service
```

---

### Problem 5: Warning — "Using price_sarimax_history.pkl as fallback"

**Symptoms**:
- API response includes warning: `"MongoDB price history collection unavailable or empty. Using price_sarimax_history.pkl as fallback."`
- Forecasts are returned successfully

**Cause**: The `saltpricehistories` collection does not exist in MongoDB. This is **expected in Phase 1** and is not an error.

**Is this a problem?** No. The service is designed to fall back to the pkl file, which contains the same 13 months of price data used during training. Predictions are accurate.

**When does this warning disappear?** In Phase 3 (12+ months post-launch), when the aggregation job begins populating `saltpricehistories` with live `pricePerKilo` data from the `deals` collection.

**Action required**: None for Phase 1. Ignore this warning. In Phase 2+, verify the aggregation job is running correctly:
```bash
# Check if saltpricehistories has data
docker exec -it compass-service mongosh "$MONGO_URI" --eval "
  db.saltpricehistories.countDocuments()
"
# Should return >= 13 in Phase 3
```

If the count is 0 after 12 months, the aggregation script is not running.
