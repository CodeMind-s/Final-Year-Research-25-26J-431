// DTOs for the ml-forecast module in compass-service
// These mirror the compass-ml-service FastAPI response shape

export interface DemandPriceForecastRequestDto {
  forecast_date?: string; // YYYY-MM-DD, optional
}

export interface DemandForecastDataDto {
  predicted_bags: number;
  method: string;
  production_source: string;
  production_forecast_bags: number;
  yield_ratio_used: number;
  yield_ratio_season: string;
  yield_ratio_sample_months: number;
  yield_ratio_source: string;  // "live_mongodb" | "regional_historical_fallback" | "none"
}

export interface PriceForecastDataDto {
  predicted_lkr_per_bag: number;
  lower_95: number;
  upper_95: number;
  model: string;
  expected_mape_pct: number;
}

export interface MonthForecastDataDto {
  month: string;
  horizon_months: number;
  demand: DemandForecastDataDto;
  price: PriceForecastDataDto;
}

export interface DemandPriceForecastResponseDto {
  success: boolean;
  message: string;
  model_version: string;
  requested_at: string;
  forecast_date: string;
  last_price_data_date: string;
  data_gap_months: number;
  forecasts: MonthForecastDataDto[];
  warnings: string[];
}
