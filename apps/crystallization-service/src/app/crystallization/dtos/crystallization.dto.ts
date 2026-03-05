export class ParametersDto {
  water_temperature: number;
  lagoon: number;
  OR_brine_level: number;
  OR_bund_level: number;
  IR_brine_level: number;
  IR_bound_level: number;
  East_channel: number;
  West_channel: number;
}

export class WeatherDto {
  temperature_mean: number;
  temperature_max: number;
  temperature_min: number;
  rain_sum: number;
  wind_speed_max: number;
  wind_gusts_max: number;
  relative_humidity_mean: number;
}

export class CreateDailyMeasurementDto {
  date: string;
  dayNumber: number;
  parameters: ParametersDto;
  weather: WeatherDto;
}

export class CreateDailyMeasurementResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export class GetDailyMeasurementByDateDto {
  date: string;
}

export class GetDailyMeasurementByDateResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export class GetDailyMeasurementsByDateRangeDto {
  startDate: string;
  endDate: string;
}

export class GetDailyMeasurementsByDateRangeResponseDto {
  success: boolean;
  message: string;
  data?: any[];
}

export class UpdateDailyMeasurementByIdDto {
  id: string;
  waterTemperature: number;
  lagoon: number;
  orBrineLevel: number;
  orBoundLevel: number;
  irBrineLevel: number;
  irBoundLevel: number;
  eastChannel: number;
  westChannel: number;
}

export class UpdateDailyMeasurementByIdResponseDto {
  success: boolean;
  message: string;
  data?: any;
}

export class DeleteDailyMeasurementByIdDto {
  id: string;
}

export class DeleteDailyMeasurementByIdResponseDto {
  success: boolean;
  message: string;
}

export class CurrentValuesDto {
  water_temperature: number;
  lagoon: number;
  OR_brine_level: number;
  OR_bund_level: number;
  IR_brine_level: number;
  IR_bound_level: number;
  East_channel: number;
  West_channel: number;
}

export class GetPredictionsDto {
  start_date: string;
  forecast_days: number;
  num_salt_beds?: number;
  latitude?: number;
  longitude?: number;
  role?: string; // SALTSOCIETY or LANDOWNER
  landowner_id?: string; // Required if role is LANDOWNER
}

export class GetPredictionsResponseDto {
  status: string;
  daily_parameters_forecast?: any;
  monthly_production_6months?: any;
  monthly_production_12months?: any;
  seasonal_production?: any;
  model_info?: any;
  summary?: any;
}

export class GetPredictedDailyMeasurementDto {
  startDate: string;
  endDate: string;
}

export class GetPredictedDailyMeasurementResponseDto {
  success: boolean;
  message: string;
  data?: any[];
}

export class GetPredictedMonthlyProductionDto {
  startMonth: string;
  endMonth: string;
}

export class GetPredictedMonthlyProductionResponseDto {
  success: boolean;
  message: string;
  data?: any[];
}

export class GetModelPerformanceDto {
  limit?: number;
}

export class GetModelPerformanceResponseDto {
  success: boolean;
  message: string;
  data?: any[];
}

export class GetWeatherForecastDto {
  lat?: number;
  lon?: number;
  cnt?: number;
}

export class GetWeatherForecastResponseDto {
  success: boolean;
  message: string;
  data?: any;
}
