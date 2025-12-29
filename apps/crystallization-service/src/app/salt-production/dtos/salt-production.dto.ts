// Request DTOs
export class CreateActualMonthlyProductionDto {
  month: string; // Format: YYYY-MM
  production_volume: number;
  season: string; // Maha or Yala
}

export class UpdateActualMonthlyProductionDto {
  id: string;
  production_volume?: number;
  season?: string;
}

export class GetActualMonthlyProductionByRangeDto {
  startMonth: string; // Format: YYYY-MM
  endMonth: string; // Format: YYYY-MM
}

export class GetActualMonthlyProductionByIdDto {
  id: string;
}

export class GetActualMonthlyProductionByMonthDto {
  month: string; // Format: YYYY-MM
}

export class DeleteActualMonthlyProductionDto {
  id: string;
}

// Response DTOs
export class ActualMonthlyProductionData {
  _id: string;
  month: string;
  production_volume: number;
  season: string;
  createdAt: string;
  updatedAt: string;
}

export class CreateActualMonthlyProductionResponseDto {
  success: boolean;
  message: string;
  data?: ActualMonthlyProductionData;
}

export class UpdateActualMonthlyProductionResponseDto {
  success: boolean;
  message: string;
  data?: ActualMonthlyProductionData;
}

export class GetActualMonthlyProductionByRangeResponseDto {
  success: boolean;
  message: string;
  data: ActualMonthlyProductionData[];
}

export class GetActualMonthlyProductionByIdResponseDto {
  success: boolean;
  message: string;
  data?: ActualMonthlyProductionData;
}

export class GetActualMonthlyProductionByMonthResponseDto {
  success: boolean;
  message: string;
  data?: ActualMonthlyProductionData;
}

export class DeleteActualMonthlyProductionResponseDto {
  success: boolean;
  message: string;
}
