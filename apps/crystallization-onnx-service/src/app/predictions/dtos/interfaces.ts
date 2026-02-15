/**
 * TypeScript interfaces matching the crystallization-prediction.proto definitions
 */

export interface CurrentValues {
    water_temperature: number;
    lagoon: number;
    OR_brine_level: number;
    OR_bund_level: number;
    IR_brine_level: number;
    IR_bound_level: number;
    East_channel: number;
    West_channel: number;
}

export interface PredictionRequest {
    start_date: string;
    forecast_days: number;
    current_values: CurrentValues;
}

export interface Parameters {
    water_temperature: number;
    lagoon: number;
    OR_brine_level: number;
    OR_bund_level: number;
    IR_brine_level: number;
    IR_bound_level: number;
    East_channel: number;
    West_channel: number;
}

export interface Weather {
    temperature_mean: number;
    temperature_min: number;
    temperature_max: number;
    rain_sum: number;
    wind_speed_max: number;
    wind_gusts_max: number;
    relative_humidity_mean: number;
}

export interface DailyForecast {
    date: string;
    day_number: number;
    parameters: Parameters;
    weather: Weather;
}

export interface DailyParametersForecast {
    forecast_type: string;
    forecast_start_date: string;
    forecast_end_date: string;
    total_days: number;
    forecasts: DailyForecast[];
}

export interface MonthlyForecast {
    month: string;
    month_number: number;
    production_forecast: number;
    lower_bound: number;
    upper_bound: number;
    season: string;
}

export interface MonthlyProductionForecast {
    forecast_type: string;
    forecast_period: string;
    forecast_start_month: string;
    forecast_end_month: string;
    total_months: number;
    total_production: number;
    forecasts: MonthlyForecast[];
}

export interface MonthProduction {
    month: string;
    production: number;
}

export interface SeasonData {
    months_count: number;
    total_production: number;
    months: MonthProduction[];
}

export interface SeasonalProduction {
    forecast_type: string;
    forecast_period: string;
    seasons: Record<string, SeasonData>;
}

export interface PerformanceMetrics {
    test_mae: number;
    test_rmse: number;
    test_r2_score: number;
    test_accuracy: number;
    validation_r2_score: number;
    validation_accuracy: number;
}

export interface ModelInfo {
    model_type: string;
    forecast_generated: string;
    performance_metrics: PerformanceMetrics;
}

export interface Summary {
    daily_forecast_days: number;
    monthly_6_total_production: number;
    monthly_12_total_production: number;
    maha_season_total: number;
    yala_season_total: number;
}

export interface PredictionResponse {
    status: string;
    daily_parameters_forecast: DailyParametersForecast;
    monthly_production_6months: MonthlyProductionForecast;
    monthly_production_12months: MonthlyProductionForecast;
    seasonal_production: SeasonalProduction;
    model_info: ModelInfo;
    summary: Summary;
}
