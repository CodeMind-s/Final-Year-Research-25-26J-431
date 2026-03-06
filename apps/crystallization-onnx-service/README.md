# Crystallization ONNX Service

A NestJS gRPC microservice that forecasts salt crystallization parameters and production volumes for Sri Lankan salt farmlands (salterns). The service combines a dual-model hybrid architecture: an **LSTM neural network** (exported to ONNX) for 60-day physical parameter forecasting, and a **linear regression formula** for long-term monthly/seasonal production planning.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [The gRPC Request](#2-the-grpc-request)
3. [The ONNX LSTM Model](#3-the-onnx-lstm-model)
4. [The Weather Input](#4-the-weather-input)
5. [The Linear Regression Production Formula](#5-the-linear-regression-production-formula)
6. [The Yield Ratio](#6-the-yield-ratio)
7. [The Seasonal Forecast](#7-the-seasonal-forecast)
8. [The Confidence Report](#8-the-confidence-report)
9. [The Retraining Pipeline](#9-the-retraining-pipeline)
10. [Complete Request-to-Response Flow](#10-complete-request-to-response-flow)
11. [Key Design Decisions](#11-key-design-decisions)
12. [Key Numbers for Presentation](#12-key-numbers-for-presentation)
13. [Environment Variables](#13-environment-variables)
14. [Running the Service](#14-running-the-service)
15. [File Structure](#15-file-structure)

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CALLER (API Gateway / Mobile App)                   │
│                    sends gRPC PredictionRequest over TCP                     │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ gRPC (TCP, proto: PredictionsService)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                   crystallization-onnx-service (NestJS)                      │
│                                                                              │
│  ┌────────────────────────┐    ┌──────────────────────────────────────────┐  │
│  │  PredictionsController │───▶│          PredictionsService              │  │
│  │  (gRPC entry point)    │    │  (orchestrates all sub-services)         │  │
│  └────────────────────────┘    └──────┬─────────────┬────────────┬───────┘  │
│                                       │             │            │           │
│                          ┌────────────▼───┐  ┌──────▼──────┐  ┌─▼──────┐   │
│                          │MlPredictorSvc  │  │ProductionFct│  │Retrain │   │
│                          │(ONNX inference)│  │Svc (formula)│  │Svc     │   │
│                          └──────┬─────────┘  └─────────────┘  └────────┘   │
│                                 │                                            │
│                          ┌──────▼──────┐                                    │
│                          │ WeatherSvc  │                                    │
│                          │(OpenWeather)│                                    │
│                          └─────────────┘                                    │
└──────────────────────────────┬───────────────────────────┬───────────────────┘
                               │                           │
              ┌────────────────▼──────┐    ┌──────────────▼──────────────┐
              │  MongoDB (Atlas)       │    │  OpenWeatherMap API          │
              │  Collections:          │    │  • /data/2.5/forecast/daily  │
              │  • DailyMeasurement   │    │    (16-day forecast)          │
              │  • ActualMonthly      │    │  • /data/3.0/onecall/        │
              │    Production         │    │    timemachine (historical)   │
              └───────────────────────┘    └──────────────────────────────┘
                               │
              ┌────────────────▼──────────────────┐
              │  Files read from disk (models/)    │
              │  • crystallization_model.onnx      │
              │  • calibration_constants.json      │
              │  • scaler_constants.json           │
              └───────────────────────────────────┘
                               │
              ┌────────────────▼──────────────────┐
              │  Kafka (Audit Log)                 │
              │  Topic: create_audit_log           │
              │  (retraining events only)          │
              └───────────────────────────────────┘
```

**In plain English:** The API Gateway calls this service via gRPC when a salt farm owner wants predictions. The service reads 60 days of real sensor data from MongoDB, fetches 60 days of weather from OpenWeatherMap, runs them both through the ONNX LSTM model (for daily physical parameters), then separately runs the linear regression formula (for monthly production volumes). It sends everything back — daily parameters, monthly totals, seasonal totals, a confidence score, and future production bands — in a single gRPC response.

---

## 2. The gRPC Request

**Proto file:** `proto/crystallization-prediction.proto`

```proto
message PredictionRequest {
  string start_date    = 1;  // REQUIRED
  int32  forecast_days = 2;  // REQUIRED
  CurrentValues current_values = 3;  // REQUIRED
  int32  num_salt_beds = 4;  // optional — defaults to 7500
  double latitude      = 5;  // optional — defaults to env or 7.2008
  double longitude     = 6;  // optional — defaults to env or 79.8737
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `start_date` | string (ISO date) | **Yes** | The date from which daily forecasts begin. Also controls which 44 days of historical sensor data are fetched from MongoDB (everything ≤ start_date). |
| `forecast_days` | int32 | **Yes** | How many days of daily parameter forecasts to return. Capped at 60 (the ONNX model always outputs exactly 60 days; fewer are simply truncated). |
| `current_values` | CurrentValues | **Yes** | Today's sensor readings at the saltern — the "right-hand edge" of the sensor history sequence. These 8 values cold-start-pad the input if there is insufficient MongoDB history. |
| `num_salt_beds` | int32 | No | How many salt crystallization beds are active at this facility. Defaults to **7500** if omitted or zero (protobuf sends 0 for unset integers). Drives the production formula: more beds → more production. |
| `latitude` | double | No | GPS latitude of the saltern for live weather fetch. Defaults to `OPENWEATHER_LAT` env variable, or **7.2008** (Puttalam region, Sri Lanka). |
| `longitude` | double | No | GPS longitude. Defaults to `OPENWEATHER_LON`, or **79.8737**. |

**What `start_date` controls:**
- The ONNX model fetches all `DailyMeasurement` records with `date ≤ start_date` (up to 60) to build its historical input sequence.
- The production history query fetches `ActualMonthlyProduction` records from `start_date − 6 months` to `start_date`.
- The monthly/seasonal forecast calendar starts from `start_date`'s month and projects forward.

**What happens when `num_salt_beds` is not provided:**
The code uses `request.num_salt_beds || 7500`. Because protobuf serialises an unset `int32` as **0**, and `0 || 7500` evaluates to `7500`, the default is silently applied. The console will log `"Using numSaltBeds: 7500"`.

---

## 3. The ONNX LSTM Model

### What Kind of Model and Why LSTM

The model is a **Long Short-Term Memory (LSTM)** recurrent neural network, exported to ONNX format. LSTM was chosen because salt crystallization is a **time-dependent process** — today's brine level, water temperature, and channel readings are direct consequences of the previous 30–60 days, not independent snapshots. LSTMs are specifically designed to learn these multi-step temporal dependencies. A standard feedforward network, which treats each day independently, would miss the lag effects (e.g. a heavy rainfall event takes 5–10 days to flush through the saltern system).

### What It Was Trained to Predict

The ONNX model predicts the **next 60 days of 8 physical parameters** at a salt crystallization facility, given the last 60 days of those parameters and 60 days of weather.

### The Two Inputs

**Input 1 — `log_input` shape `[1, 60, 8]`**

- `1` = batch size (one request at a time)
- `60` = sequence length (60 daily time steps)
- `8` = number of saltern parameters

The 8 saltern parameters, in order, are:

| Index | Parameter | Physical Meaning |
|---|---|---|
| 0 | `water_temperature` | Temperature of the seawater entering the saltern (°C). Controls evaporation rate. |
| 1 | `lagoon` | Water depth in the primary lagoon (m). The initial reservoir before brine concentration begins. |
| 2 | `OR_brine_level` | Brine depth in the Outer Reservoir (m). Higher = more concentrated brine ready for crystallization. |
| 3 | `OR_bund_level` | Water level on the embankment of the Outer Reservoir (m). Affects how much brine can be held without overflow. |
| 4 | `IR_brine_level` | Brine depth in the Inner Reservoir (m). The final pre-crystallization holding tank. |
| 5 | `IR_bound_level` | Embankment level of the Inner Reservoir (m). |
| 6 | `East_channel` | Water level in the east distribution channel (m). Channels move brine between pans. |
| 7 | `West_channel` | Water level in the west distribution channel (m). |

**Before being fed to the model, each feature is normalised using a RobustScaler:**
```
X_scaled = (X - center) / scale
```
The `center` and `scale` values come from `scaler_constants.json → log_scaler`.

**Input 2 — `weather_input` shape `[1, 60, 14]`**

- `60` = same 60-day time window
- `14` = 14 daily weather features (temperature mean/max/min, rain, wind speed max/mean/min, wind gusts max/mean/min, humidity mean×2/max/min)

Weather data is assembled as **44 days historical + 16 days forecast**. Each weather feature is normalised using `scaler_constants.json → weather_scaler`.

### The Output

**Shape: `[1, 480]` → reshaped to `[60, 8]`**

The model outputs a flat tensor of 480 values. The service reshapes this into 60 rows × 8 columns — one row per day, one column per saltern parameter. Each value is then **de-normalised** using the inverse RobustScaler:
```
X_original = X_scaled * scale + center
```

### Model Performance Metrics

| Metric | Value | What it means |
|---|---|---|
| Test MAE | **0.226** | On held-out test data, the model's predictions were wrong by 0.226 units on average across all 8 parameters (in normalised space — roughly ±0.2–0.45 physical units per parameter). |
| Test RMSE | **0.365** | Similar to MAE but penalises large errors more. The model rarely makes big mistakes. |
| Test R² | **0.775** | On new data the model has never seen, it explains **77.5%** of the variance in the 8 parameters. |
| Validation R² | **0.889** | During training validation, it explained **88.9%** of variance. |

**Is this good?** For a physical system with inherent weather noise, 77.5% test R² is **solid**. Validation R² of 88.9% shows the model generalises well. The gap between validation and test R² (11 points) is normal for time-series models — test data is further in the future and contains more novel weather patterns. For the purpose of a 60-day operational planning horizon in salt farming, these metrics are appropriate and actionable.

### Cold-Start Handling

When a new saltern has fewer than 60 days of `DailyMeasurement` records in MongoDB, the service **pads the missing days at the front** using the oldest available record (or the `current_values` from the request). This means:

- If 30 days of history exist → the first 30 slots of the 60-step sequence are filled with the oldest real record, the next 30 slots use actual data.
- If 0 days exist → all 60 slots are filled with `current_values`.

This avoids crashes and still produces predictions, though predictions become less accurate when fewer days of real history are available.

---

## 4. The Weather Input

### Where the 60 Days of Weather Come From

The `WeatherService.buildWeatherInput()` function assembles exactly **60 days of weather** as:

```
[─────────── 44 days historical ──────────│─── 16 days forecast ───]
    (startDate − 44) to (startDate − 1)      today + 0 to + 15
```

### Which OpenWeatherMap APIs Are Used

| API | Endpoint | Purpose |
|---|---|---|
| **One Call Timemachine** | `https://api.openweathermap.org/data/3.0/onecall/timemachine` | Historical weather, one request per day, batched in groups of 10 to respect rate limits. |
| **Daily Forecast** | `https://api.openweathermap.org/data/2.5/forecast/daily` | 16-day future forecast, one request returns all 16 days. |

If the API key is missing or either call fails, the service **falls back gracefully** to the historical monthly averages stored in `calibration_constants.json → historical_weather`. The model keeps running — it just uses average weather instead of live weather for the affected days.

### The 14 Weather Features (in order)

```
temperature_mean, temperature_max, temperature_min,
rain_sum,
wind_speed_max, wind_gusts_max, wind_gusts_mean, wind_speed_mean, wind_gusts_min, wind_speed_min,
relative_humidity_mean, relative_humidity_mean_2, relative_humidity_max, relative_humidity_min
```

### How Hourly Data Is Aggregated to Daily

When the API returns sub-daily (3-hourly) data, `aggregateHourlyToDaily()` groups records by `YYYY-MM-DD`, then:
- **Mean** for temperature, wind speed, wind gusts, humidity
- **Sum** for rain
- **Max** for daily maxima fields
- **Min** for daily minima fields

### Why Weather Is Critical for Salt Crystallization

Salt crystallization is driven by **evaporation**, which depends directly on temperature, wind speed, and humidity. High temperature → faster evaporation → faster brine concentration → faster crystal formation. Wind accelerates evaporation at the water surface. Rainfall is destructive: it dilutes the brine, resets concentration progress, and in extreme cases washes away crystals. The LSTM needs to see weather history to learn "it rained 3 days ago → brine level dropped → production will lag for another 2 weeks."

---

## 5. The Linear Regression Production Formula

### Why a Separate Formula Instead of the ONNX Model

The ONNX model operates at the **physical parameter level** (water levels in cm, temperatures in °C). It cannot directly output monthly production in bags — that relationship involves the number of salt beds, seasonal rainfall, and long-term climate patterns. A separate, interpretable linear regression formula was deliberately designed to predict **monthly production volumes in bags of salt**, using macroscopic inputs that farm managers understand. The ONNX model answers *"what will the saltern conditions look like day by day?"*, while the formula answers *"how many bags will this facility produce next month?"*

### The Formula

```
expected_bags = (beds_coef × num_salt_beds)
              + (rain_coef × avg_rain_mm)
              + (temp_coef × avg_temp_c)
              + (sin_coef  × sin(2π × month / 12))
              + (cos_coef  × cos(2π × month / 12))
              + intercept
```

**Coefficient values from `calibration_constants.json`:**

| Term | Coefficient | Value | Physical Meaning |
|---|---|---|---|
| `beds_coef × num_salt_beds` | **35.215** | 35.215 | Each additional active salt bed adds ~35 bags/month to expected production. With 7500 beds, this term contributes **264,114 bags** before other adjustments. |
| `rain_coef × avg_rain_mm` | **−33.926** | −33.926 | **Negative** because rain dilutes brine. Every 1 mm of monthly rainfall *reduces* expected output by ~34 bags. In November (avg 459.8 mm rain), this subtracts **15,594 bags** from the prediction — a major production killer. |
| `temp_coef × avg_temp_c` | **3763.359** | 3763.359 | Higher temperature accelerates evaporation. Each 1°C increase adds ~3,763 bags/month. At the average temperature of 27°C, this term contributes **~101,600 bags**. |
| `sin_coef × sin(2πm/12)` | **4703.369** | 4703.369 | The sine component of the annual Fourier cycle, capturing the **first half of the seasonal wave**. |
| `cos_coef × cos(2πm/12)` | **6675.845** | 6675.845 | The cosine component, capturing the **phase offset** of the seasonal wave. Together, sin and cos encode a smooth repeating seasonal cycle without needing month dummy variables. |
| `intercept` | **−279,846.18** | −279,846.18 | A large negative baseline that sets the absolute scale. Without it, the formula would massively overestimate at low bed counts/temperatures. It effectively represents the fixed overhead that must be overcome before any production occurs. |

### The Two-Tier Forecasting System

Because the formula was trained on data from a large facility (typically 7,500+ beds), its coefficients and especially the massive `-279,846` intercept are calibrated for macro-scale production. Applying this formula directly to an individual owner with only 30 beds produces nonsensical negative numbers.

To solve this, the service implements a **two-tier system** based on `num_salt_beds`:

| Tier | Condition | How future production is calculated |
|---|---|---|
| **Tier 1 (Facility)** | `beds ≥ 2000` | The linear regression formula is used directly with the provided `num_salt_beds`. |
| **Tier 2 (Individual Owner)** | `beds < 2000` | The service calculates what the *entire facility* would produce using the `historical_avg_beds` (e.g., 6897.2). It then divides this by `historical_avg_beds` to get a **per-bed rate**. This rate is multiplied by the owner's `num_salt_beds` (e.g., rate × 30). |

This ensures that even a 20-bed farm gets a mathematically sound, seasonally accurate forecast scaled perfectly to their size.

### After applying yield ratio:
```python
expected = base_formula_or_scaled_beds × yieldRatio
lower95  = max(0, expected − pi_half_width)
upper95  = expected + pi_half_width
```

### R² = 0.9732 — What It Means

The formula explains **97.32%** of the month-to-month variance in production across the training dataset. In plain English: if you draw a scatter plot of actual vs. predicted monthly production across all 36 months, the points cluster extremely tightly around the diagonal line. Only 2.68% of variation is unexplained. This is very strong for a 5-variable formula operating on noisy agricultural data.

### The 95% Prediction Interval (pi_half_width = 15,739 bags)

The `pi_half_width` is calculated as:
```
pi_half_width = 1.96 × residual_std_deviation
```
The holdout `resid_std` = 7,706.68 bags.
So: `1.96 × 7706.68 = 15,739 bags`.

This means: **95% of the time, actual production will fall within ±15,739 bags of the predicted value**. These bands are based on measured residuals from the actual regression fit, making them statistically principled rather than an arbitrary percentage.

### Why Linear Regression Over ARIMA or Holt-Winters

| Method | Why it was rejected |
|---|---|
| **ARIMA** | Requires a stationary time series. Salt production is non-stationary (strong seasonal trend, driven by exogenous variables like beds and weather). ARIMA cannot incorporate num_salt_beds or rainfall as predictors without complex ARIMAX extensions — and even then, interpretability would suffer. |
| **Holt-Winters** | A pure trend+seasonality decomposition. Cannot incorporate the physical causal variables (rain, temperature, bed count) that actually drive production. Would overfit to historical patterns and fail when a farm adds or removes beds. |
| **Linear Regression** | Directly uses the physical causal variables. Interpretable. O(n) fit time. Handles structural changes (new beds, exceptional rainfall). The high R² (0.9732) proves it captures the dominant drivers of production. |

---

## 6. The Yield Ratio

### What It Is and Why It Exists

The production formula was calibrated on **aggregate saltern data** representing an average facility in the Puttalam region. Individual salt farm owners perform very differently — one with poor brine management, aged equipment, or inconsistent harvesting may produce only 35% of what the formula predicts, while an efficient farm might exceed 100%. The **yield ratio** is a per-facility calibration factor that adjusts the formula output to match each owner's historical performance.

### How It Is Calculated

The calculation method depends on the tier, but the crucial rule is: **MongoDB stores actual production for the entire facility, not individual owners.**

Therefore, during calibration:
1. The service ALWAYS computes the *formula baseline* using `historical_avg_beds` (representing the full facility).
2. For each historical month: `ratio = actual_facility_production / formula_facility_prediction`
3. The service takes the **median** of all historical ratios.

This ensures the yield ratio measures the *true efficiency* of the salt farming operation against the climate, rather than creating an exploded ratio by comparing 112,000 actual bags against a 30-bed prediction.

### Why Median Instead of Mean

The median is robust to outlier months — shutdown months (floods, equipment failure, religious festivals) can produce a production figure near zero, which would create a tiny ratio like 0.01. If included in a mean, this would drag the yield ratio down significantly, making the forecast pessimistic for all future months. The median automatically ignores such extremes without requiring manual data cleaning.

### The 4 Yield Status Levels

| Status | Yield Ratio Range | Operational Meaning |
|---|---|---|
| **CRITICAL** | < 0.3 | The facility produces less than 30% of the formula baseline. Likely causes: major equipment failure, abandoned beds, very poor brine management, or the farm is functionally shut down. Forecasts should be treated with extreme caution. |
| **LOW** | 0.3 – 0.5 | Significantly underperforming. The farm is operational but faces serious structural issues — possibly too few workers, damaged embankments, or suboptimal brine circulation. Major intervention recommended. |
| **BELOW_AVERAGE** | 0.5 – 0.8 | Below the regional average but functional. Common for newer or smaller operations still optimising their process. The forecast is reliable but conservatively adjusted. |
| **NORMAL** | ≥ 0.8 | The facility is performing at or above the regional average. The formula + yield ratio produces a reliable forecast. |

### Trend Detection

The ratios are split into first half and second half chronologically:
```
diff = mean(second_half) − mean(first_half)
```
- `decliningTrend = true` if diff < −0.2 (performance is worsening — confidence score is penalised by −20 points)
- `improvingTrend = true` if diff > 0.2 (performance is improving)

### A Real Example

**Scenario:** `yieldRatio = 0.357`, `num_salt_beds = 7500`, month = August.

The formula predicts (for August, with historical weather):
```
= 35.215 × 7500  + (−33.926 × 78.3)  + 3763.359 × 28.06
+ 4703.369 × sin(2π×8/12)  + 6675.845 × cos(2π×8/12)
+ (−279,846)
≈ 264,113 − 2,656 + 105,577 + 4,073 − 3,338 − 279,846
≈ ~87,923 bags (base)
```
After yield ratio: `87,923 × 0.357 = ~31,388 bags`.

Without the yield ratio the formula would predict ~87,923 bags. But this particular facility has historically produced only 35.7% of that — meaning they only actually get ~31,388 bags. A yieldRatio of 0.357 is in the **LOW** band, signalling the farm has a serious efficiency problem.

---

## 7. The Seasonal Forecast

### Sri Lanka Salt Farming Seasons

Sri Lanka's salt production follows the two monsoon seasons:

| Season | Months | Characteristics |
|---|---|---|
| **Yala** | May, June, July, August | The primary dry season. The south-west monsoon brings minimal rain to the north-west coast (Puttalam). Consistent sunshine and sea breezes create ideal evaporation conditions. **Peak production season.** Year-to-year variance is low (~14%) because the weather is reliably dry. |
| **Maha** | November, December, January, February | The secondary dry window, interrupted by the north-east monsoon. Higher unpredictability. November in particular can have 459 mm of rain, severely disrupting production. Production is lower and year-to-year variance is high (~50%) — this is why Maha forecasts carry wider uncertainty bands. |
| **Transition** | March, April, September, October | Inter-monsoon periods. Production is intermediate. March–April transition into Yala, September–October into Maha. These months have variable rainfall and are used as operational buffer periods. |

### How the Seasonal Forecast Is Built

For each month in the current and next season, the service checks:
- **Is the month in the past (before the current calendar month)?** → fetch **ACTUAL** production from MongoDB
- **Is the month the current or future month?** → run the **calibration formula** to generate a PREDICTED value

The `SeasonForecast` object then contains:
- `actualToDate` — the sum of actual production bags already harvested this season
- `expectedTotal` — actual + formula predictions for remaining months
- `lower95Total` — actualToDate + sum of lower95 bounds for predicted months
- `upper95Total` — actualToDate + sum of upper95 bounds for predicted months

This design means the seasonal forecast becomes more accurate as the season progresses — early in the season it is all prediction; by the final month it is mostly actual data.

---

## 8. The Confidence Report

The confidence report answers: *"How much should I trust this forecast?"* It generates a 0–100 score from four components.

### Scoring Breakdown (Weighted)

| Component | Weight | Score Calculation | Current Value (from constants) |
|---|---|---|---|
| **Formula R² fit** | 30% | `r2_score × 100` | `0.9732 × 100 = 97.32` pts |
| **Holdout MAE** | 40% | `max(0, 100 − holdout_mae / 1000)` | `max(0, 100 − 7956/1000) = 92.04` pts |
| **Data volume** | 20% | `min((n_months / 60) × 100, 100)` | `min((36/60)×100, 100) = 60.0` pts |
| **Yield performance** | 10% | NORMAL=90, BELOW_AVERAGE=70, LOW/CRITICAL=40 (−20 if declining) | Depends on facility history |

```
overallScore = (97.32 × 0.30) + (92.04 × 0.40) + (60.0 × 0.20) + (yieldScore × 0.10)
             = 29.20 + 36.82 + 12.00 + [yieldScore × 0.10]
```

### Bed Count Tier & Transparency

The confidence report also returns exactly how the numbers were generated based on farm size:

- **`bedCountTier`**: Either `"FACILITY"` (≥2000 beds) or `"INDIVIDUAL_OWNER"` (<2000 beds).
- **`bedCountNote`**: Recommends caution to individual owners: *"Forecast uses per-bed scaling. Owner has 30 beds vs facility average... Accuracy depends on this owner performing proportionally to the facility average."* (Omitted for Tier 1 users).

### Overall Ratings

| Score | Rating | Meaning for Decision Makers |
|---|---|---|
| ≥ 80 | **HIGH CONFIDENCE** | Forecast is reliable for financial planning, contracts, and inventory decisions. |
| 60–79 | **MEDIUM CONFIDENCE — suitable for planning** | Use for operational planning but add a buffer. Do not commit to large contracts. |
| 40–59 | **LOW-MEDIUM — use as a guide** | Indicative only. Cross-check with field observations. |
| < 40 | **LOW CONFIDENCE** | Do not rely on this forecast for financial decisions. |

### What holdoutMae = 7,956 Bags Means

When the formula was trained on the last N−6 months and tested on the most recent 6 months, the average error per month was **7,956 bags**. In practical terms: if a farm with 7,500 beds is predicted to produce 80,000 bags in a month, the actual production will typically be within ±7,956 bags — i.e., between 72,044 and 87,956 bags. For a salt farm owner, this is useful knowledge for managing inventory and cash flow.

### Why nHistoryMonths Matters

The data volume score scales linearly toward **60 months** (5 years). Currently at **36 months**, the score is 60/100 for this component. The intuition is: more data covers more seasonal cycles, more weather extremes, more operational states. The formula becomes more reliable as it sees more of the facility's actual history. At 60 months of data, this component contributes its full 20 points, pushing the overall score firmly into HIGH CONFIDENCE territory.

### decliningTrend: true

If the second half of the historical ratios is more than 0.2 lower than the first half (meaning the farm is progressively underperforming), the confidence score is penalised by −20 yield score points. This flags that the forecast may be optimistic — the trend is moving away from the calibration data.

---

## 9. The Retraining Pipeline

### When It Runs

A **cron job** fires at **midnight on the 1st of every month**:
```typescript
@Cron('0 0 1 * *')
async scheduledRetrain() { ... }
```
It can also be triggered manually via the `TriggerRetraining` gRPC method.

### What Data It Uses

All `ActualMonthlyProduction` records in MongoDB, sorted chronologically. Minimum 12 months required to retrain.

### What It Recalculates (11-Step Process)

1. Read current `calibration_constants.json`
2. Fetch all production records from MongoDB
3. Build feature matrix **X** = `[beds, rain, temp, sin, cos]` per month
4. Fit `MultivariateLinearRegression` on all data → produces 5 new coefficients + intercept
5. Compute residuals and **residual standard deviation** → new `resid_std`
6. Calculate new **95% prediction interval** = `1.96 × resid_std`
7. Evaluate **holdout MAE** on the last 6 months (train on first N−6, test on last 6)
8. Calculate new **R² score** on all data
9. **Atomic write** — write to `.tmp` file first, then rename to replace the original
10. Log a summary (old vs. new R², holdout MAE, pi_half_width, n_months)
11. Emit a **Kafka audit log** event to topic `create_audit_log`

### What Atomic Write Means and Why It Matters

A direct file write (`writeFile`) can fail midway, leaving a corrupted partial JSON. The service avoids this by:
```
write → calibration_constants.json.tmp   (temporary file)
rename → calibration_constants.json       (atomic OS operation)
```
An OS `rename` is atomic on POSIX systems, meaning it either fully succeeds or is never visible. The running service's constants are never corrupt.

### How the Running Service Picks Up New Coefficients Without Restarting

The `RetrainingService.onModuleInit()` starts a **chokidar file watcher** on `calibration_constants.json`:
```typescript
watcher.on('change', async () => {
    await this.productionForecastService.loadConstants();
});
```
The watcher waits 300ms after the file stabilises (`awaitWriteFinish`), then triggers a hot reload. The next prediction request uses the new coefficients without any service restart or downtime.

### How Accuracy Improves Over Time

| Time | Data | Expected R² |
|---|---|---|
| Now (Year 3) | 36 months | 0.9732 |
| Year 5 | ~60 months | ~0.98+ |
| Year 7 | ~84 months | Converges, diminishing returns |

More data means the formula has seen more weather extremes, monsoon anomalies, and farm operational variations. The coefficients better represent the true relationship. The holdout MAE is expected to decrease as the model becomes better calibrated.

---

## 10. Complete Request-to-Response Flow

```
gRPC Request arrives at PredictionsController.getPredictions()
         │
         ▼
Step 1:  PredictionsService — validate model is ready
         (mlPredictor.isReady() → always true, with mock fallback)

Step 2:  Parse start_date → Date object
         Clamp forecast_days to min(request.forecast_days, 60)
         Extract 8 currentParams from request.current_values
         Resolve lat/lon (request → env → hardcoded default)

Step 3:  MlPredictorService.predict(currentParams, startDate, lat, lon)
         │
         ├─ Step 3a: buildLogInput()
         │   ├── Query MongoDB: DailyMeasurement WHERE date ≤ startDate
         │   │   ORDER BY date DESC LIMIT 60 → reverse to oldest-first
         │   ├── Cold-start pad: if fewer than 60 records, fill front
         │   │   with oldest available (or currentParams)
         │   └── Normalise each value: (v − center) / scale
         │       using scaler_constants.json → log_scaler
         │   → logTensor [1, 60, 8]
         │
         ├─ Step 3b: WeatherService.buildWeatherInput(lat, lon, startDate)
         │   ├── Fetch 44 days historical weather from OpenWeatherMap
         │   │   (timemachine API, batched 10 at a time)
         │   ├── Fetch 16 days forecast weather from OpenWeatherMap
         │   │   (/forecast/daily API)
         │   ├── Combine → 60 days
         │   ├── Normalise each value: (v − center) / scale
         │   │   using scaler_constants.json → weather_scaler
         │   └── → weatherTensor [1, 60, 14]
         │
         ├─ Step 3c: onnxRuntime.run({log_input, weather_input})
         │   → outputData [1, 480]
         │
         └─ Step 3d: Reshape [1, 480] → [60, 8]
             Denormalise: val * scale + center (log_scaler)
             → allDaysPredictions: number[][] (60 rows × 8 cols)

Step 4:  PredictionsService.buildDailyForecasts()
         Slice first forecast_days rows from allDaysPredictions
         Map each row to DailyForecast{date, day_number, parameters}
         Attach placeholder Weather object (random within typical range)
         → dailyForecasts[]

Step 5:  PredictionsService.fetchProductionHistory(startDate)
         Query MongoDB: ActualMonthlyProduction
         WHERE month BETWEEN (startDate − 6 months) AND startDate
         ORDER BY month ASC
         → productionHistory[]

Step 6:  ProductionForecastService.forecast({currentDate, numSaltBeds, productionHistory})
         │
         ├─ Step 6a: computeYieldRatio(history, numSaltBeds)
         │   For each historical month: ratio = actual / formulaPrediction
         │   Take median of all ratios → yieldRatio
         │
         ├─ Step 6b: detectYieldStatus(yieldRatio)  → NORMAL/BELOW_AVERAGE/LOW/CRITICAL
         │
         ├─ Step 6c: detectTrend(ratios)  → {decliningTrend, improvingTrend}
         │
         ├─ Step 6d: buildSeasonForecast(currentSeason)
         │   For each month in season:
         │     past + actual data in DB  → type: 'ACTUAL'
         │     current/future            → forecastMonth() → type: 'PREDICTED'
         │   → currentSeasonForecast
         │
         ├─ Step 6e: buildSeasonForecast(nextSeason)
         │   Same logic for next agricultural season
         │   → nextSeasonForecast
         │
         ├─ Step 6f: calibratedMonthlyForecast (next 2 months)
         │   forecastMonth(month+1), forecastMonth(month+2)
         │
         ├─ Step 6g: generateMonthlyProductionForecast(6 months)
         │   forecastMonth() × 6 → MonthlyProductionForecast
         │
         ├─ Step 6h: generateMonthlyProductionForecast(12 months)
         │   forecastMonth() × 12 → MonthlyProductionForecast
         │
         ├─ Step 6i: generateSeasonalProduction(12-month forecast)
         │   Aggregate by season name → SeasonalProduction
         │
         └─ Step 6j: computeConfidence(yieldRatio, yieldStatus, trend, nMonths)
             Weighted score → ConfidenceReport

Step 7:  PredictionsService assembles PredictionResponse:
         {
           status: 'success',
           daily_parameters_forecast,   ← from Step 4 (ONNX)
           monthly_production_6months,  ← from Step 6g (formula)
           monthly_production_12months, ← from Step 6h (formula)
           seasonal_production,         ← from Step 6i (formula)
           model_info,                  ← ONNX performance metrics
           summary,                     ← totals for quick access
           calibratedMonthlyForecast,   ← from Step 6f (2 months)
           seasonalForecast,            ← from Steps 6d+6e
           confidence                   ← from Step 6j
         }

Step 8:  PredictionsController returns PredictionResponse to gRPC caller
```

---

## 11. Key Design Decisions

### 1. Why ONNX Instead of Running Python Directly?

ONNX Runtime runs inside the NestJS Node.js process via `onnxruntime-node`. The alternative — spawning a Python subprocess per request or running a separate FastAPI/Flask server — adds at least 200–500ms of IPC overhead per request, requires two containers to be alive simultaneously, and introduces Python versioning problems in a Docker environment. ONNX allows the model to be treated as a **native library call** with microsecond inference time after initial load, zero serialization overhead, and a single-container deployment.

### 2. Why Two Separate Models (LSTM + Linear Regression)?

The LSTM operates at the **physical parameter level** (water levels, temperatures) on a 60-day horizon. It cannot extrapolate to monthly production volumes because it was not trained on production outcomes — and training it on production directly would require years of labelled production data at the individual parameter level. The linear regression operates at the **business outcome level** (bags per month), trained directly on real production records with clean, interpretable inputs. Combining both captures the best of each: the LSTM captures short-term physical dynamics; the regression captures long-term agricultural economics. Attempting a single model for both would sacrifice interpretability and require vastly more training data.

### 3. Why Historical Monthly Weather Averages for the Formula Instead of Live Weather?

Monthly production forecasts extend 12 months into the future. Live weather is only available 16 days ahead. For months 2–12, the formula must use the best available estimate of future weather — which is the historical monthly average for that region. These averages are computed from 36 months of actual weather data and stored in `calibration_constants.json → historical_weather`. Using fake live weather for months 3–12 would give a false impression of precision while actually being less accurate than the stable long-run average.

### 4. Why Median Yield Ratio Instead of Mean?

Salt farms occasionally have shutdown months (cyclones, equipment failure, harvest delays). A shutdown month produces near-zero production → a ratio near 0.0. Including this in a mean would permanently depress the yield ratio and make all future forecasts pessimistic. The **median is robust**: it ignores outliers by definition, using only the middle value(s) of the sorted ratio list. No manual data cleaning is required.

### 5. Why Linear Regression Over ARIMA or Holt-Winters?

Linear regression directly models the **causal inputs** (beds, rain, temperature, seasonality). ARIMA and Holt-Winters are pure time-series methods that model patterns in historical values without understanding *why* production changes. When a farm adds 500 new salt beds, ARIMA has no way to know production will increase — it would only learn this gradually from future data. The linear regression predicts the increase immediately because `beds_coef × 500 = +17,607 bags/month` is computed directly. The R²=0.9732 empirically confirms this causal model outperforms autoregressive alternatives.

### 6. Why 95% Prediction Intervals Instead of Fixed ±15% Bands?

Fixed percentage bands (e.g. ±15% of expected) compress to small absolute values when expected production is low (e.g. a bad month at 20,000 bags → only ±3,000 bags). The statistically derived `pi_half_width = 1.96 × residual_std` is computed from the **actual observed errors** of the regression on its training data. It reflects the true forecast uncertainty regardless of the production level, making it meaningful for financial planning and risk assessment. If the model's residuals change after retraining (more data → smaller std), the interval automatically narrows.

### 7. Why Fetch Production History from MongoDB Instead of Requiring the Caller to Pass It?

The caller (API Gateway or mobile app) does not hold historical production data — it would need to query it anyway. Having each downstream service independently query the database avoids: (a) large payloads in the gRPC request, (b) duplicating query logic across multiple callers, and (c) callers knowing the schema of the production collection. The service privately owns its data access layer via `@InjectModel(ActualMonthlyProduction.name)` and exposes only the computed outputs.

---

## 12. Key Numbers for Presentation

### ONNX LSTM Model

| Property | Value |
|---|---|
| Model type | LSTM (Long Short-Term Memory) |
| Format | ONNX (`crystallization_model.onnx`) |
| Input 1 name / shape | `log_input` → `[1, 60, 8]` |
| Input 2 name / shape | `weather_input` → `[1, 60, 14]` |
| Output shape | `[1, 480]` → reshaped `[60, 8]` |
| Test MAE | **0.226** (normalised space) |
| Test RMSE | **0.365** (normalised space) |
| Test R² | **0.7750** (77.5%) |
| Validation R² | **0.8884** (88.84%) |
| Normalisation method | RobustScaler (center/scale from `scaler_constants.json`) |

### Linear Regression Production Formula

| Property | Value |
|---|---|
| Training months | **36 months** |
| R² (in-sample) | **0.9732** |
| Holdout MAE | **7,956 bags/month** |
| 95% PI half-width | **15,739 bags** |
| Residual std | **7,706.68 bags** |
| Minimum data to retrain | 12 months |
| Historical average beds | **6,897.2** beds |

### Coefficients (from `calibration_constants.json`)

| Coefficient | Value | Plain English |
|---|---|---|
| `beds_coef` | **35.215** | Each salt bed adds ~35 bags/month |
| `rain_coef` | **−33.926** | Each mm of rain reduces output by ~34 bags |
| `temp_coef` | **3,763.359** | Each 1°C adds ~3,763 bags/month (evaporation effect) |
| `sin_coef` | **4,703.369** | Amplitude of the sine seasonal wave component |
| `cos_coef` | **6,675.845** | Amplitude of the cosine seasonal wave component |
| `intercept` | **−279,846.182** | Large negative baseline offset (scale-setting constant) |

### Seasons

| Season | Months | Variance |
|---|---|---|
| Yala | May, Jun, Jul, Aug | ~14% year-to-year |
| Maha | Nov, Dec, Jan, Feb | ~50% year-to-year |
| Transition | Mar, Apr, Sep, Oct | Intermediate |

### Confidence Score (with NORMAL yield status, 36 months)

| Component | Score | Weight | Contribution |
|---|---|---|---|
| Formula R² | 97.32 | 30% | 29.20 |
| Holdout MAE | 92.04 | 40% | 36.82 |
| Data volume | 60.00 | 20% | 12.00 |
| Yield (NORMAL) | 90.00 | 10% | 9.00 |
| **TOTAL** | — | 100% | **87.02 → HIGH CONFIDENCE** |

**How many months until HIGH CONFIDENCE threshold (80)?**
At 36 months, data score = 60. To reach HIGH CONFIDENCE with NORMAL yield, data score contribution needs to be ≥ `80 − 29.20 − 36.82 − 9.00 = 4.98` from the 20% weight component. That requires `data_score ≥ 24.9`, which means only `n_months ≥ 15` months — already exceeded. The service is already in HIGH CONFIDENCE range with a NORMAL-performing facility. The score improves further as more months accumulate toward 60.

---

## 13. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | No | Atlas hardcoded fallback | MongoDB connection string |
| `OPENWEATHER_API_KEY` | **Yes** for live weather | — | OpenWeatherMap API key (without this, falls back to historical monthly averages) |
| `OPENWEATHER_LAT` | No | `7.2008` | Default latitude for weather fetch |
| `OPENWEATHER_LON` | No | `79.8737` | Default longitude for weather fetch |
| `KAFKA_BROKER` | No | `localhost:29092` | Kafka broker address for audit logging |

---

## 14. Running the Service

### Development

```bash
# From the monorepo root
npx nx serve crystallization-onnx-service
```

### Production Build

```bash
npx nx build crystallization-onnx-service
node dist/apps/crystallization-onnx-service/main.js
```

### Required Files in `models/`

```
apps/crystallization-onnx-service/models/
├── crystallization_model.onnx    ← MANDATORY (service throws if missing)
├── calibration_constants.json    ← MANDATORY (formula coefficients)
└── scaler_constants.json         ← MANDATORY (normalisation parameters)
```

### gRPC Port

The service exposes a gRPC server. Check `apps/crystallization-onnx-service/src/main.ts` for the configured port (typically **5007** or configured via environment variable).

---

## 15. File Structure

```
apps/crystallization-onnx-service/
├── models/
│   ├── crystallization_model.onnx      ← LSTM model in ONNX format
│   ├── calibration_constants.json      ← Linear regression coefficients
│   └── scaler_constants.json           ← RobustScaler normalisation params
├── src/
│   └── app/
│       ├── app.module.ts               ← Root module (MongoDB connection)
│       └── predictions/
│           ├── predictions.controller.ts   ← gRPC entry point
│           ├── predictions.service.ts      ← Request orchestrator
│           ├── ml-predictor.service.ts     ← ONNX inference engine
│           ├── production-forecast.service.ts  ← Formula + yield ratio engine
│           ├── retraining.service.ts       ← Monthly auto-retraining
│           ├── weather.service.ts          ← OpenWeatherMap integration
│           ├── predictions.module.ts       ← NestJS module config
│           ├── dtos/
│           │   └── interfaces.ts           ← TypeScript type definitions
│           └── schemas/
│               ├── daily-measurement.schema.ts      ← Mongoose: sensor data
│               └── actual-monthly-production.schema.ts  ← Mongoose: production records
└── proto/
    └── crystallization-prediction.proto   ← gRPC service definition
```

---

## Architecture Summary

This service implements a **hybrid dual-model AI system**:

1. **Short-term intelligence (LSTM/ONNX):** Understands the physical dynamics of salt crystallization on a day-by-day basis, incorporating real sensor data and live weather.

2. **Long-term intelligence (Linear Regression):** Understands the agricultural economics of salt production, accounting for farm capacity (beds), seasonal rainfall, temperature, and individual farm performance (yield ratio).

3. **Self-improving (Retraining Pipeline):** Every month, the regression formula automatically retrains on new data, the file watcher hot-reloads the coefficients, and the audit log records the change. The model gets more accurate with every season of data.

4. **Uncertainty-aware (Confidence Report + Prediction Intervals):** Rather than producing a single number, every forecast includes 95% prediction intervals and a transparent, decomposed confidence score so decision-makers understand exactly how reliable the forecast is.
