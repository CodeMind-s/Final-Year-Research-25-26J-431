"""
forecast.py — Demand and price forecasting logic for compass-ml-service.

═══════════════════════════════════════════════════════════════════════════════
RETRAIN GUIDANCE
═══════════════════════════════════════════════════════════════════════════════
The price model (SARIMAX) should be retrained when:
  1. New monthly price data is available  → retrain at least monthly.
  2. /api/v1/health returns data_gap_months > 2  → stale model, retrain ASAP.
  3. A structural market change occurs (new government pricing, policy change,
     major salt production event).

HOW TO RETRAIN:
  Run sarimax_price_model.py in Google Colab, then replace these 3 files in
  the models/ volume mount and restart the service (no code changes needed):
    price_sarimax.pkl
    price_sarimax_history.pkl
    price_sarimax_meta.json

IMPORTANT NOTE ON DIRECTIONAL ACCURACY:
  The SARIMAX model has MAPE ≈ 1.2% (very accurate price level prediction)
  but directional accuracy of 46.3% (slightly below coin-flip for up/down
  direction). This means:
    ✅  The predicted price LEVEL is accurate (within ~21 LKR/bag)
    ⚠️   The model cannot reliably predict whether price will go UP or DOWN
  For procurement planning this is acceptable — operations teams need the
  price level for budget calculation, not the direction.
  directional_accuracy is stored in meta.json for internal monitoring only
  and is NOT exposed in the API response to avoid confusion.
═══════════════════════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from mongo_client import MongoClient, REGIONAL_YIELD_RATIO_MAHA, REGIONAL_YIELD_RATIO_YALA, REGIONAL_YIELD_RATIO_TRANSITION

logger = logging.getLogger(__name__)

# ── Season helpers ────────────────────────────────────────────────────────────────

# Maha = Oct → Mar (months 10, 11, 12, 1, 2, 3)
MAHA_MONTHS = {10, 11, 12, 1, 2, 3}


def get_season(month_number: int) -> str:
    """Return 'maha' or 'yala' based on calendar month (1-12)."""
    return "maha" if month_number in MAHA_MONTHS else "yala"


def is_maha(month_number: int) -> int:
    """Return 1 if Maha season, 0 if Yala (for SARIMAX exog encoding)."""
    return 1 if month_number in MAHA_MONTHS else 0


# ── Demand forecast ───────────────────────────────────────────────────────────

def forecast_demand(
    production_bags_m1: Optional[float],
    production_bags_m2: Optional[float],
    mongo: MongoClient,
    forecast_date: datetime.date,
    warnings: List[str],
    season_m1: Optional[str] = None,
    season_m2: Optional[str] = None,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Compute demand forecasts for month+1 and month+2 relative to forecast_date.

    Steps:
      1. Query last 36 months of ActualMonthlyProduction from MongoDB.
      2. Attempt to compute season yield ratio = mean(demand_bags / production_bags)
         If demand_bags is absent → use FALLBACK_YIELD_RATIO and add warning.
      3. demand = production_forecast × yield_ratio
      4. If season_m1/season_m2 are provided (from crystallization service),
         use those instead of deriving from month number.

    Returns two dicts (one per horizon month) matching the DemandForecast schema.
    """
    # Determine target months
    first_of_current = forecast_date.replace(day=1)
    if first_of_current.month == 12:
        m1_date = first_of_current.replace(year=first_of_current.year + 1, month=1)
    else:
        m1_date = first_of_current.replace(month=first_of_current.month + 1)

    if m1_date.month == 12:
        m2_date = m1_date.replace(year=m1_date.year + 1, month=1)
    else:
        m2_date = m1_date.replace(month=m1_date.month + 1)

    # Use passed season if available, otherwise derive from month number
    if season_m1:
        detected_season_m1 = season_m1.lower()
    else:
        detected_season_m1 = get_season(m1_date.month)
    
    if season_m2:
        detected_season_m2 = season_m2.lower()
    else:
        detected_season_m2 = get_season(m2_date.month)

    # Pull history from MongoDB
    try:
        history = mongo.get_yield_ratio_history(months=36)
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"MongoDB yield history unavailable: {exc}")
        history = []

    # Compute yield ratios per season from live data
    season_ratios: Dict[str, Tuple[float, int]] = {}  # season → (ratio, sample_count)
    live_ratios_available = False

    if history:
        demand_available = [
            r for r in history if r.get("demand_bags") is not None
        ]
        if demand_available:
            live_ratios_available = True
            for season_name in ("maha", "yala"):
                season_records = [
                    r for r in demand_available
                    if r.get("season", "").lower() == season_name
                    and r["production_bags"] > 0
                ]
                if season_records:
                    ratios = [
                        r["demand_bags"] / r["production_bags"]
                        for r in season_records
                    ]
                    season_ratios[season_name] = (
                        float(np.mean(ratios)),
                        len(ratios),
                    )

    if not live_ratios_available:
        warnings.append(
            "Demand yield ratio using regional Puttalam historical data "
            f"(Maha={REGIONAL_YIELD_RATIO_MAHA}, Yala={REGIONAL_YIELD_RATIO_YALA}, Transition={REGIONAL_YIELD_RATIO_TRANSITION}). "
            "Platform will switch to live farm data automatically once deal "
            "history accumulates."
        )

    def _build_demand(
        production_bags: Optional[float],
        season: str,
        horizon: int,
    ) -> Dict[str, Any]:
        # Handle None or NaN production values
        if production_bags is None or (isinstance(production_bags, float) and np.isnan(production_bags)):
            return {
                "predicted_bags": None,
                "method": "production_yield_ratio",
                "production_source": "crystallization_onnx_service",
                "production_forecast_bags": None,
                "yield_ratio_used": None,
                "yield_ratio_season": season,
                "yield_ratio_sample_months": 0,
                "yield_ratio_source": "none",
            }

        if live_ratios_available and season in season_ratios:
            # Use live MongoDB data
            ratio, samples = season_ratios[season]
            predicted_bags = int(round(production_bags * ratio))
            return {
                "predicted_bags": predicted_bags,
                "method": "production_yield_ratio",
                "production_source": "crystallization_onnx_service",
                "production_forecast_bags": production_bags,
                "yield_ratio_used": round(ratio, 6),
                "yield_ratio_season": season,
                "yield_ratio_sample_months": samples,
                "yield_ratio_source": "live_mongodb",
            }
        else:
            # Use regional historical fallback (Puttalam 168-month dataset)
            if season == "maha":
                ratio = REGIONAL_YIELD_RATIO_MAHA
            elif season == "yala":
                ratio = REGIONAL_YIELD_RATIO_YALA
            elif season == "transition":
                ratio = REGIONAL_YIELD_RATIO_TRANSITION
            else:
                # Fallback to month-based detection if season not recognized
                ratio = REGIONAL_YIELD_RATIO_MAHA if season == "maha" else REGIONAL_YIELD_RATIO_YALA
            
            predicted_bags = int(round(production_bags * ratio))
            return {
                "predicted_bags": predicted_bags,
                "method": "production_yield_ratio",
                "production_source": "crystallization_onnx_service",
                "production_forecast_bags": production_bags,
                "yield_ratio_used": ratio,
                "yield_ratio_season": season,
                "yield_ratio_sample_months": 0,
                "yield_ratio_source": "regional_historical_fallback",
            }

    demand_m1 = _build_demand(production_bags_m1, detected_season_m1, 1)
    demand_m2 = _build_demand(production_bags_m2, detected_season_m2, 2)

    return demand_m1, demand_m2


# ── Price forecast (SARIMAX two-pass) ────────────────────────────────────────

def _build_exog_row(
    month_date: datetime.date,
    price_lag_12m: Optional[float],
    price_lag_1m: Optional[float],
    total_production_bags: Optional[float],
) -> List[float]:
    """
    Build one exog row in the exact column order required by the SARIMAX model:
      [is_maha_season, price_lag_12m, price_lag_1m, total_production_bags]
    """
    season_flag = float(is_maha(month_date.month))
    lag_12 = float(price_lag_12m) if price_lag_12m is not None else 0.0
    lag_1 = float(price_lag_1m) if price_lag_1m is not None else 0.0
    prod = float(total_production_bags) if total_production_bags is not None else 0.0
    return [season_flag, lag_12, lag_1, prod]


def forecast_price(
    model,
    history_df: pd.DataFrame,
    meta: Dict[str, Any],
    mongo: MongoClient,
    forecast_date: datetime.date,
    warnings: List[str],
) -> Dict[str, Any]:
    """
    Two-pass SARIMAX price forecast for month+1 and month+2.

    Pass 1: forecast month+1 using actual lags.
    Pass 2: use month+1 prediction as price_lag_1m for month+2.

    Returns dict with keys:
      m1_predicted, m1_lower, m1_upper, m1_mape
      m2_predicted, m2_lower, m2_upper, m2_mape
    """
    perf = meta.get("performance", {})
    m1_mape = perf.get("month_plus_1_mape")
    m2_mape = perf.get("month_plus_2_mape")

    # ── Determine forecast months ─────────────────────────────────────────────
    first_of_current = forecast_date.replace(day=1)
    if first_of_current.month == 12:
        m1_date = first_of_current.replace(year=first_of_current.year + 1, month=1)
    else:
        m1_date = first_of_current.replace(month=first_of_current.month + 1)

    if m1_date.month == 12:
        m2_date = m1_date.replace(year=m1_date.year + 1, month=1)
    else:
        m2_date = m1_date.replace(month=m1_date.month + 1)

    # ── Resolve history DataFrame ─────────────────────────────────────────────
    # Try live MongoDB first, fall back to pkl if not enough data.
    live_history: List[Dict[str, Any]] = []
    try:
        live_history = mongo.get_price_history(months=13)
    except Exception as exc:  # noqa: BLE001
        warnings.append(f"MongoDB price history unavailable: {exc}. Using pkl fallback.")

    use_live = len(live_history) >= 13
    if not use_live:
        if live_history:
            warnings.append(
                f"MongoDB price history has only {len(live_history)} records "
                f"(need ≥13). Using price_sarimax_history.pkl as fallback."
            )
        else:
            warnings.append(
                "MongoDB price history collection unavailable or empty. "
                "Using price_sarimax_history.pkl as fallback."
            )
        work_df = history_df.copy()
    else:
        work_df = pd.DataFrame(live_history)
        work_df["date"] = pd.to_datetime(work_df["date"])
        work_df = work_df.sort_values("date")
        work_df = work_df.set_index("date")
        work_df.index = work_df.index.to_period("M").to_timestamp()

    # Ensure descending sort for lag lookups
    work_df_sorted = work_df.sort_index(ascending=False)

    def _get_price_at_date(target_year: int, target_month: int) -> Optional[float]:
        """Look up price_mean for a given year-month."""
        try:
            target_ts = pd.Timestamp(year=target_year, month=target_month, day=1)
            row = work_df[work_df.index == target_ts]
            if not row.empty:
                return float(row["price_mean"].iloc[0])
        except Exception:  # noqa: BLE001
            pass
        return None

    # Last known actual price (most recent row)
    last_price: Optional[float] = None
    last_prod: Optional[float] = None
    if not work_df.empty:
        latest_row = work_df.sort_index().iloc[-1]
        last_price = float(latest_row.get("price_mean", 0.0))
        last_prod = float(latest_row.get("total_production_bags", 0.0))

    # ── Lag lookups ───────────────────────────────────────────────────────────
    # price_lag_12m for month+1 = price 12 months before m1_date
    lag12_m1_year = m1_date.year - 1 if m1_date.month > 0 else m1_date.year
    lag12_m1_month = m1_date.month  # same month, 1 year prior
    price_lag12_m1 = _get_price_at_date(
        m1_date.year - 1, m1_date.month
    )

    # price_lag_12m for month+2 = price 12 months before m2_date
    price_lag12_m2 = _get_price_at_date(
        m2_date.year - 1, m2_date.month
    )

    if price_lag12_m1 is None:
        warnings.append(
            f"price_lag_12m for {m1_date.strftime('%Y-%m')} not found in history. "
            "Using last known price as proxy."
        )
        price_lag12_m1 = last_price

    if price_lag12_m2 is None:
        warnings.append(
            f"price_lag_12m for {m2_date.strftime('%Y-%m')} not found in history. "
            "Using last known price as proxy."
        )
        price_lag12_m2 = last_price

    # ── PASS 1: forecast month+1 ──────────────────────────────────────────────
    exog_m1 = np.array([
        _build_exog_row(m1_date, price_lag12_m1, last_price, last_prod)
    ], dtype=float)

    try:
        fc_m1 = model.get_forecast(steps=1, exog=exog_m1)
        
        # Guard for predicted_mean which can also be an ndarray
        pm_m1 = fc_m1.predicted_mean
        predicted_m1 = float(pm_m1[0]) if isinstance(pm_m1, np.ndarray) else float(pm_m1.iloc[0])
        # summary_frame() returns a DataFrame in modern statsmodels.
        # If it fails or returns a numpy array, fall back to conf_int().
        try:
            summary_m1 = fc_m1.summary_frame(alpha=0.05)
            lower_m1 = float(summary_m1["mean_ci_lower"].iloc[0])
            upper_m1 = float(summary_m1["mean_ci_upper"].iloc[0])
        except Exception:  # noqa: BLE001
            ci_m1 = fc_m1.conf_int(alpha=0.05)
            lower_m1 = float(ci_m1[0, 0]) if isinstance(ci_m1, np.ndarray) else float(ci_m1.iloc[0, 0])
            upper_m1 = float(ci_m1[0, 1]) if isinstance(ci_m1, np.ndarray) else float(ci_m1.iloc[0, 1])
    except Exception as exc:  # noqa: BLE001
        logger.error("SARIMAX pass-1 forecast failed: %s", exc)
        raise

    # ── PASS 2: forecast month+2 using m+1 prediction as price_lag_1m ────────
    exog_m2 = np.array([
        _build_exog_row(m2_date, price_lag12_m2, predicted_m1, last_prod)
    ], dtype=float)

    full_exog = np.vstack([exog_m1, exog_m2])  # shape (2, 4)

    try:
        fc_full = model.get_forecast(steps=2, exog=full_exog)
        
        pm_full = fc_full.predicted_mean
        predicted_m2 = float(pm_full[1]) if isinstance(pm_full, np.ndarray) else float(pm_full.iloc[1])
        try:
            summary_full = fc_full.summary_frame(alpha=0.05)
            lower_m2 = float(summary_full["mean_ci_lower"].iloc[1])
            upper_m2 = float(summary_full["mean_ci_upper"].iloc[1])
        except Exception:  # noqa: BLE001
            ci_full = fc_full.conf_int(alpha=0.05)
            lower_m2 = float(ci_full[1, 0]) if isinstance(ci_full, np.ndarray) else float(ci_full.iloc[1, 0])
            upper_m2 = float(ci_full[1, 1]) if isinstance(ci_full, np.ndarray) else float(ci_full.iloc[1, 1])
    except Exception as exc:  # noqa: BLE001
        logger.error("SARIMAX pass-2 forecast failed: %s", exc)
        raise

    result = {
        "m1_predicted": round(predicted_m1, 2),
        "m1_lower": round(lower_m1, 2),
        "m1_upper": round(upper_m1, 2),
        "m1_mape": m1_mape,
        "m2_predicted": round(predicted_m2, 2),
        "m2_lower": round(lower_m2, 2),
        "m2_upper": round(upper_m2, 2),
        "m2_mape": m2_mape,
    }

    # ── Write predictions to pricepredictions collection ──────────────────────
    # Write one document per forecast month. Failures are non-fatal.
    perf = meta.get("performance", {})
    model_version = meta.get("version", "price_sarimax_v1.0")
    for horizon, m_date, predicted, lower, upper, mape in [
        (1, m1_date, predicted_m1, lower_m1, upper_m1, m1_mape),
        (2, m2_date, predicted_m2, lower_m2, upper_m2, m2_mape),
    ]:
        try:
            mongo.write_price_prediction({
                "forecast_date": forecast_date.strftime("%Y-%m-%d"),
                "month": m_date.strftime("%Y-%m"),
                "horizon_months": horizon,
                "predicted_lkr_per_bag": round(predicted, 2),
                "lower_95": round(lower, 2),
                "upper_95": round(upper, 2),
                "model_version": model_version,
                "expected_mape_pct": mape,
            })
            logger.info(
                "Wrote price prediction for month %s (horizon %d)",
                m_date.strftime("%Y-%m"), horizon,
            )
        except Exception as write_exc:  # noqa: BLE001
            logger.warning(
                "Failed to write price prediction for month %s: %s",
                m_date.strftime("%Y-%m"), write_exc,
            )

    return result
