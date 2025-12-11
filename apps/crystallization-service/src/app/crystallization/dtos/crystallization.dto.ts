export class CreateDailyMeasurementDto {
  date: string;
  waterTemperature: number;
  lagoon: number;
  orBrineLevel: number;
  orBoundLevel: number;
  irBrineLevel: number;
  irBoundLevel: number;
  eastChannel: number;
  westChannel: number;
}

export class CreateDailyMeasurementResponseDto {
  success: boolean;
  message: string;
  daily_measurement?: any;
}
