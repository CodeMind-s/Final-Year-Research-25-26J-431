"""
models.py — Pydantic v2 schemas for demand-price-service (compass-ml-service).
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ─── Request ────────────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    forecast_date: Optional[date] = Field(default=None)
    production_forecast_m1: float = Field(gt=0)
    production_forecast_m2: float = Field(gt=0)
    production_month_m1: str = Field(pattern=r"^\d{4}-\d{2}$")
    production_month_m2: str = Field(pattern=r"^\d{4}-\d{2}$")
    season_m1: Optional[str] = None
    season_m2: Optional[str] = None


# ─── Demand sub-model ────────────────────────────────────────────────────────

class DemandForecast(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    predicted_bags: Optional[int] = None
    method: str = "production_yield_ratio"
    production_source: str = "crystallization_onnx_service"
    production_forecast_bags: Optional[float] = None
    yield_ratio_used: Optional[float] = None
    yield_ratio_season: Optional[str] = None
    yield_ratio_sample_months: Optional[int] = None
    yield_ratio_source: str = "none"


# ─── Price sub-model ─────────────────────────────────────────────────────────

class PriceForecast(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    predicted_lkr_per_bag: Optional[float] = None
    lower_95: Optional[float] = None
    upper_95: Optional[float] = None
    model: str = "SARIMAX"
    expected_mape_pct: Optional[float] = None


# ─── Per-month combined forecast ─────────────────────────────────────────────

class MonthForecast(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    month: str
    horizon_months: int
    demand: DemandForecast
    price: PriceForecast


# ─── Full response ───────────────────────────────────────────────────────────

class ForecastResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    requested_at: datetime
    forecast_date: str
    last_price_data_date: Optional[str] = None
    data_gap_months: Optional[int] = None
    forecasts: List[MonthForecast]
    warnings: List[str] = Field(default_factory=list)


# ─── Health response ─────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str                              # "ok" | "degraded" | "unhealthy"
    sarimax_model_loaded: bool
    sarimax_version: Optional[str] = None
    sarimax_last_data_date: Optional[str] = None
    data_gap_months: Optional[int] = None
    mongodb_connected: bool
