"""
main.py — FastAPI application entry-point for compass-ml-service (demand-price-service).

Startup (lifespan):
  a) Load price_sarimax_meta.json → log version + last_data_date
  b) Load price_sarimax.pkl       → store in AppState
  c) Load price_sarimax_history.pkl → store in AppState as fallback history
  d) Connect to MongoDB (MONGO_URI) → ping, fail fast if unreachable

Environment variables:
  MODEL_DIR                    path to directory containing the 3 model files
  MONGO_URI                    MongoDB connection string  (matches project convention)
  MONGO_DB_NAME                optional, defaults to "test" (inferred from URI)

ARCHITECTURE NOTE:
  This service does NOT call crystallization-onnx-service directly.
  The API Gateway orchestrates both services, passing production forecasts
  from crystallization-onnx-service to this service via the request body.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import pickle
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from forecast import forecast_demand, forecast_price, get_season
from models import (
    DemandForecast,
    ForecastRequest,
    ForecastResponse,
    HealthResponse,
    MonthForecast,
    PriceForecast,
)
from mongo_client import MongoClient

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Environment ───────────────────────────────────────────────────────────────

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")
MONGO_URI = os.getenv("MONGO_URI", "")  # matches project env-var name (MONGO_URI)
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "test")

# ── Application state ─────────────────────────────────────────────────────────


class AppState:
    sarimax_model: Optional[Any] = None
    sarimax_history_df: Optional[pd.DataFrame] = None
    sarimax_meta: Optional[Dict[str, Any]] = None
    mongo: Optional[MongoClient] = None


state = AppState()


# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup & shutdown."""

    # ── a) Load meta JSON ─────────────────────────────────────────────────────
    meta_path = os.path.join(MODEL_DIR, "price_sarimax_meta.json")
    if not os.path.exists(meta_path):
        raise RuntimeError(
            f"price_sarimax_meta.json not found at {meta_path}. "
            "Mount the models/ directory and ensure the file exists."
        )
    with open(meta_path, "r") as f:
        state.sarimax_meta = json.load(f)
    version = state.sarimax_meta.get("version", "unknown")
    last_data_date = state.sarimax_meta.get("last_data_date", "unknown")
    logger.info("SARIMAX meta loaded — version: %s, last_data_date: %s", version, last_data_date)

    # ── b) Load SARIMAX model ─────────────────────────────────────────────────
    model_path = os.path.join(MODEL_DIR, "price_sarimax.pkl")
    if not os.path.exists(model_path):
        raise RuntimeError(
            f"price_sarimax.pkl not found at {model_path}. "
            "Ensure the model file is present in the models/ volume."
        )
    try:
        with open(model_path, "rb") as f:
            state.sarimax_model = pickle.load(f)
        logger.info("SARIMAX model loaded from %s", model_path)
    except Exception as exc:
        raise RuntimeError(f"Failed to load price_sarimax.pkl: {exc}") from exc

    # ── c) Load history fallback DataFrame ───────────────────────────────────
    history_path = os.path.join(MODEL_DIR, "price_sarimax_history.pkl")
    if not os.path.exists(history_path):
        raise RuntimeError(
            f"price_sarimax_history.pkl not found at {history_path}. "
            "Ensure the model file is present in the models/ volume."
        )
    try:
        with open(history_path, "rb") as f:
            state.sarimax_history_df = pickle.load(f)
        logger.info(
            "SARIMAX history pkl loaded — %d rows", len(state.sarimax_history_df)
        )
    except Exception as exc:
        raise RuntimeError(f"Failed to load price_sarimax_history.pkl: {exc}") from exc

    # ── d) Connect to MongoDB ─────────────────────────────────────────────────
    if not MONGO_URI:
        raise RuntimeError(
            "MONGO_URI environment variable is not set. "
            "Set it in docker-compose or your .env file."
        )
    state.mongo = MongoClient(mongo_uri=MONGO_URI, db_name=MONGO_DB_NAME)
    try:
        state.mongo.connect()
        logger.info("MongoDB connection established.")
    except Exception as exc:
        raise RuntimeError(f"MongoDB connection failed at startup: {exc}") from exc

    yield  # ── application runs ───────────────────────────────────────────────

    # ── Shutdown ──────────────────────────────────────────────────────────────
    if state.mongo:
        state.mongo.close()
        logger.info("MongoDB connection closed.")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Compass ML Service — Demand & Price Forecast",
    version="1.0.0",
    description=(
        "Derives monthly salt demand from crystallization production forecasts "
        "and predicts salt prices using a SARIMAX model."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _next_two_months(base_date: datetime.date):
    """Return (month1_date, month2_date) as the 1st of the next two months."""
    first = base_date.replace(day=1)
    if first.month == 12:
        m1 = first.replace(year=first.year + 1, month=1)
    else:
        m1 = first.replace(month=first.month + 1)
    if m1.month == 12:
        m2 = m1.replace(year=m1.year + 1, month=1)
    else:
        m2 = m1.replace(month=m1.month + 1)
    return m1, m2


def _compute_data_gap(meta: Dict[str, Any]) -> Optional[int]:
    """Return months between last_data_date and today."""
    last_data_str = meta.get("last_data_date")
    if not last_data_str:
        return None
    try:
        last_dt = datetime.datetime.strptime(last_data_str, "%Y-%m-%d").date()
        today = datetime.date.today()
        return (today.year - last_dt.year) * 12 + (today.month - last_dt.month)
    except ValueError:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/api/v1/health", response_model=HealthResponse)
async def health(response: Response):
    """
    Health check endpoint.
    Returns HTTP 200 even if degraded — check 'status' field.
    Returns HTTP 503 only if the SARIMAX model could not be loaded.
    """
    model_loaded = state.sarimax_model is not None
    mongo_ok = state.mongo.ping() if state.mongo else False

    meta = state.sarimax_meta or {}
    version = meta.get("version")
    last_data_date = meta.get("last_data_date")
    data_gap = _compute_data_gap(meta)

    if not model_loaded:
        status = "unhealthy"
        response.status_code = 503
    elif not mongo_ok:
        status = "degraded"
    else:
        status = "ok"

    return HealthResponse(
        status=status,
        sarimax_model_loaded=model_loaded,
        sarimax_version=version,
        sarimax_last_data_date=last_data_date,
        data_gap_months=data_gap,
        mongodb_connected=mongo_ok,
    )


@app.post("/api/v1/demand-price-forecast", response_model=ForecastResponse)
async def demand_price_forecast(req: ForecastRequest):
    """
    Unified demand + price forecast for the next 2 months.
    
    The API Gateway provides production forecasts from crystallization-onnx-service.
    This service computes demand (production × yield_ratio) and price (SARIMAX).
    """
    if state.sarimax_model is None:
        raise HTTPException(status_code=503, detail="SARIMAX model not loaded.")

    forecast_date = req.forecast_date or datetime.date.today()
    requested_at = datetime.datetime.now(datetime.timezone.utc)
    warnings: list[str] = []

    m1_date, m2_date = _next_two_months(forecast_date)

    meta = state.sarimax_meta or {}
    version = meta.get("version", "unknown")
    last_data_date = meta.get("last_data_date")
    data_gap = _compute_data_gap(meta)

    # Validate production months match expected months
    expected_m1 = m1_date.strftime("%Y-%m")
    expected_m2 = m2_date.strftime("%Y-%m")
    
    if req.production_month_m1 != expected_m1:
        warnings.append(
            f"Production month+1 mismatch: expected {expected_m1}, got {req.production_month_m1}"
        )
    if req.production_month_m2 != expected_m2:
        warnings.append(
            f"Production month+2 mismatch: expected {expected_m2}, got {req.production_month_m2}"
        )

    # ── Demand: compute yield ratio ───────────────────────────────────────────
    demand_dict_m1, demand_dict_m2 = forecast_demand(
        production_bags_m1=req.production_forecast_m1,
        production_bags_m2=req.production_forecast_m2,
        mongo=state.mongo,
        forecast_date=forecast_date,
        warnings=warnings,
        season_m1=req.season_m1,
        season_m2=req.season_m2,
    )

    # ── Price: SARIMAX two-pass ───────────────────────────────────────────────
    try:
        price_result = forecast_price(
            model=state.sarimax_model,
            history_df=state.sarimax_history_df,
            meta=meta,
            mongo=state.mongo,
            forecast_date=forecast_date,
            warnings=warnings,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Price forecast failed: %s", exc)
        warnings.append(f"Price forecast failed with error: {exc}")
        price_result = {
            "m1_predicted": None, "m1_lower": None, "m1_upper": None, "m1_mape": None,
            "m2_predicted": None, "m2_lower": None, "m2_upper": None, "m2_mape": None,
        }

    # ── Assemble response ─────────────────────────────────────────────────────
    forecasts = [
        MonthForecast(
            month=m1_date.strftime("%Y-%m"),
            horizon_months=1,
            demand=DemandForecast(**demand_dict_m1),
            price=PriceForecast(
                predicted_lkr_per_bag=price_result["m1_predicted"],
                lower_95=price_result["m1_lower"],
                upper_95=price_result["m1_upper"],
                expected_mape_pct=price_result["m1_mape"],
            ),
        ),
        MonthForecast(
            month=m2_date.strftime("%Y-%m"),
            horizon_months=2,
            demand=DemandForecast(**demand_dict_m2),
            price=PriceForecast(
                predicted_lkr_per_bag=price_result["m2_predicted"],
                lower_95=price_result["m2_lower"],
                upper_95=price_result["m2_upper"],
                expected_mape_pct=price_result["m2_mape"],
            ),
        ),
    ]

    return ForecastResponse(
        model_version=version,
        requested_at=requested_at,
        forecast_date=str(forecast_date),
        last_price_data_date=last_data_date,
        data_gap_months=data_gap,
        forecasts=forecasts,
        warnings=warnings,
    )
