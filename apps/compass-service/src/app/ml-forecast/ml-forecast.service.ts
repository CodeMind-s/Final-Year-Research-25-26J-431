import { Injectable, Logger } from '@nestjs/common';
import { DemandPriceForecastResponseDto } from './dtos/ml-forecast.dto';

@Injectable()
export class MlForecastService {
  private readonly logger = new Logger(MlForecastService.name);
  
  // URL of the compass-ml-service (FastAPI) — injected via env var
  private readonly mlServiceUrl: string =
    process.env.COMPASS_ML_SERVICE_URL || 'http://compass-ml-service:8002';

  async getDemandPriceForecast(
    forecastDate?: string,
    production_forecast_m1?: number,
    production_forecast_m2?: number,
    production_month_m1?: string,
    production_month_m2?: string,
    season_m1?: string,
    season_m2?: string,
  ): Promise<DemandPriceForecastResponseDto> {
    const url = `${this.mlServiceUrl}/api/v1/demand-price-forecast`;
    
    const body: Record<string, any> = {
      production_forecast_m1,
      production_forecast_m2,
      production_month_m1,
      production_month_m2,
      season_m1,
      season_m2,
    };
    
    if (forecastDate && forecastDate.trim()) {
      body.forecast_date = forecastDate.trim();
    }

    this.logger.log(`Calling compass-ml-service: POST ${url} body=${JSON.stringify(body)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`compass-ml-service error ${response.status}: ${errorText}`);
        return {
          success: false,
          message: `ML service returned HTTP ${response.status}: ${errorText}`,
          model_version: '',
          requested_at: new Date().toISOString(),
          forecast_date: forecastDate || '',
          last_price_data_date: '',
          data_gap_months: 0,
          forecasts: [],
          warnings: [`ML service HTTP error: ${response.status}`],
        };
      }

      const data = await response.json() as DemandPriceForecastResponseDto;
      this.logger.log(`compass-ml-service responded: model_version=${data.model_version}`);

      // Map to gRPC-compatible response (numbers must be finite)
      return {
        success: true,
        message: 'Demand and price forecast retrieved successfully',
        model_version: data.model_version ?? '',
        requested_at: String(data.requested_at ?? ''),
        forecast_date: String(data.forecast_date ?? ''),
        last_price_data_date: String(data.last_price_data_date ?? ''),
        data_gap_months: Number(data.data_gap_months ?? 0),
        forecasts: (data.forecasts ?? []).map((f: any) => ({
          month: f.month ?? '',
          horizon_months: Number(f.horizon_months ?? 0),
          demand: {
            predicted_bags: f.demand?.predicted_bags ?? null,
            method: f.demand?.method ?? '',
            production_source: f.demand?.production_source ?? '',
            production_forecast_bags: f.demand?.production_forecast_bags ?? null,
            yield_ratio_used: f.demand?.yield_ratio_used ?? null,
            yield_ratio_season: f.demand?.yield_ratio_season ?? '',
            yield_ratio_sample_months: f.demand?.yield_ratio_sample_months ?? null,
            yield_ratio_source: f.demand?.yield_ratio_source ?? 'none',
          },
          price: {
            predicted_lkr_per_bag: f.price?.predicted_lkr_per_bag ?? null,
            lower_95: f.price?.lower_95 ?? null,
            upper_95: f.price?.upper_95 ?? null,
            model: f.price?.model ?? '',
            expected_mape_pct: f.price?.expected_mape_pct ?? null,
          },
        })),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      };
    } catch (error: any) {
      this.logger.error(`Failed to call compass-ml-service: ${error.message}`);
      return {
        success: false,
        message: `Failed to reach ML service: ${error.message}`,
        model_version: '',
        requested_at: new Date().toISOString(),
        forecast_date: forecastDate || '',
        last_price_data_date: '',
        data_gap_months: 0,
        forecasts: [],
        warnings: [`ML service unreachable: ${error.message}`],
      };
    }
  }
}
