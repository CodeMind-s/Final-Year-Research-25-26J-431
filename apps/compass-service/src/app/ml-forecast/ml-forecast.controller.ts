import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { MlForecastService } from './ml-forecast.service';

// DTOs are used as plain interfaces — no class decorators needed
// Using inline types to avoid isolatedModules emitDecoratorMetadata issues

@Controller('MlForecast')
export class MlForecastController {
  constructor(private readonly mlForecastService: MlForecastService) {}

  @GrpcMethod('HarvestPlanService', 'GetDemandPriceForecast')
  async GetDemandPriceForecast(
    data: {
      forecast_date?: string;
      production_forecast_m1?: number;
      production_forecast_m2?: number;
      production_month_m1?: string;
      production_month_m2?: string;
      season_m1?: string;
      season_m2?: string;
    },
  ): Promise<any> {
    return this.mlForecastService.getDemandPriceForecast(
      data.forecast_date,
      data.production_forecast_m1,
      data.production_forecast_m2,
      data.production_month_m1,
      data.production_month_m2,
      data.season_m1,
      data.season_m2,
    );
  }
}
