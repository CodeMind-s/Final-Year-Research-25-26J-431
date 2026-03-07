import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

// ─── Request ────────────────────────────────────────────────────────────────

export class DemandPriceForecastRequestDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'forecast_date must be in YYYY-MM-DD format' })
  @ApiPropertyOptional({
    description: 'Forecast reference date (YYYY-MM-DD). Defaults to today if omitted.',
    example: '2026-03-05',
  })
  forecast_date?: string;
}

// ─── Nested response types ───────────────────────────────────────────────────

export class DemandForecastDataDto {
  @ApiProperty({ example: 82000 })
  predicted_bags: number;

  @ApiProperty({ example: 'production_yield_ratio' })
  method: string;

  @ApiProperty({ example: 'crystallization_onnx_service' })
  production_source: string;

  @ApiProperty({ example: 820000 })
  production_forecast_bags: number;

  @ApiProperty({ example: 0.1027 })
  yield_ratio_used: number;

  @ApiProperty({ example: 'maha' })
  yield_ratio_season: string;

  @ApiProperty({ example: 18 })
  yield_ratio_sample_months: number;

  @ApiProperty({ example: 'regional_historical_fallback', description: 'Either "live_mongodb", "regional_historical_fallback", or "none"' })
  yield_ratio_source: string;
}

export class PriceForecastDataDto {
  @ApiProperty({ example: 1638.50 })
  predicted_lkr_per_bag: number;

  @ApiProperty({ example: 1620.00 })
  lower_95: number;

  @ApiProperty({ example: 1657.00 })
  upper_95: number;

  @ApiProperty({ example: 'SARIMAX' })
  model: string;

  @ApiProperty({ example: 1.164 })
  expected_mape_pct: number;
}

export class MonthForecastDataDto {
  @ApiProperty({ example: '2026-04' })
  month: string;

  @ApiProperty({ example: 1 })
  horizon_months: number;

  @ApiProperty({ type: DemandForecastDataDto })
  demand: DemandForecastDataDto;

  @ApiProperty({ type: PriceForecastDataDto })
  price: PriceForecastDataDto;
}

// ─── Full response ───────────────────────────────────────────────────────────

export class DemandPriceForecastResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Demand and price forecast retrieved successfully' })
  message: string;

  @ApiProperty({ example: 'price_sarimax_v1.0' })
  model_version: string;

  @ApiProperty({ example: '2026-03-05T10:00:00Z' })
  requested_at: string;

  @ApiProperty({ example: '2026-03-05' })
  forecast_date: string;

  @ApiProperty({ example: '2025-12-01' })
  last_price_data_date: string;

  @ApiProperty({ example: 3 })
  data_gap_months: number;

  @ApiProperty({ type: [MonthForecastDataDto] })
  forecasts: MonthForecastDataDto[];

  @ApiProperty({ type: [String], example: [] })
  warnings: string[];
}
