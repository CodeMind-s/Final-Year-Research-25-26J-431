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

export class GetDailyMeasurementByDateDto {
  date: string;
}

export class GetDailyMeasurementByDateResponseDto {
  success: boolean;
  message: string;
  daily_measurement?: any;
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
  daily_measurement?: any;
}

export class DeleteDailyMeasurementByIdDto {
  id: string;
}

export class DeleteDailyMeasurementByIdResponseDto {
  success: boolean;
  message: string;
}

