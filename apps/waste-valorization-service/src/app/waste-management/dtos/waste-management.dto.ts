import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetWastePredictionsDto {
  @ApiProperty({
    description: 'Start date in ISO format (YYYY-MM-DD)',
    example: '2026-02-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date in ISO format (YYYY-MM-DD)',
    example: '2026-03-17',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: 'Include averages in response',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeAverages?: boolean;
}

export class WastePredictionEntry {
  @ApiProperty({ description: 'Date in ISO format (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Predicted waste in kg' })
  predicted_waste: number;

  @ApiProperty({ description: 'Production volume in kg' })
  production_volume: number;

  @ApiProperty({ description: 'Rain sum in mm' })
  rain_sum: number;

  @ApiProperty({ description: 'Mean temperature in Celsius' })
  temperature_mean: number;

  @ApiProperty({ description: 'Mean humidity percentage' })
  humidity_mean: number;

  @ApiProperty({ description: 'Mean wind speed in km/h' })
  wind_speed_mean: number;

  @ApiProperty({ description: 'Type of entry', enum: ['historical', 'predicted'] })
  type: 'historical' | 'predicted';

  // Solid waste breakdown
  @ApiProperty({ description: 'Gypsum waste in kg' })
  solid_waste_gypsum: number;

  @ApiProperty({ description: 'Limestone residue in kg' })
  solid_waste_limestone: number;

  @ApiProperty({ description: 'Low-grade industrial salt in kg' })
  solid_waste_industrial_salt: number;

  @ApiProperty({ description: 'Total solid waste in kg' })
  total_solid_waste: number;

  // Liquid waste breakdown
  @ApiProperty({ description: 'Bittern waste brine in L' })
  liquid_waste_bittern: number;

  @ApiProperty({ description: 'Recoverable Epsom salt (MgSO4) in kg' })
  potential_epsom_salt: number;

  @ApiProperty({ description: 'Recoverable potash (K2O) in kg' })
  potential_potash: number;

  @ApiProperty({ description: 'Recoverable magnesium oil in L' })
  potential_magnesium_oil: number;

  @ApiProperty({ description: 'Total liquid waste in L' })
  total_liquid_waste: number;
  
  // Computed metrics
  waste_to_production_ratio_percent?: number | null;
  solid_waste_percentage_percent?: number | null;
  valorization_potential?: number | null;
}

export class WasteAverages {
  @ApiProperty({ description: 'Average production volume' })
  production_volume: number;

  @ApiProperty({ description: 'Average rain sum' })
  rain_sum: number;

  @ApiProperty({ description: 'Average temperature' })
  temperature_mean: number;

  @ApiProperty({ description: 'Average humidity' })
  humidity_mean: number;

  @ApiProperty({ description: 'Average wind speed' })
  wind_speed_mean: number;

  @ApiProperty({ description: 'Average predicted waste' })
  predicted_waste: number;

  // Solid waste breakdown averages
  @ApiProperty({ description: 'Average gypsum waste in kg' })
  solid_waste_gypsum: number;

  @ApiProperty({ description: 'Average limestone residue in kg' })
  solid_waste_limestone: number;

  @ApiProperty({ description: 'Average low-grade industrial salt in kg' })
  solid_waste_industrial_salt: number;

  @ApiProperty({ description: 'Average total solid waste in kg' })
  total_solid_waste: number;

  // Liquid waste breakdown averages
  @ApiProperty({ description: 'Average bittern waste brine in L' })
  liquid_waste_bittern: number;

  @ApiProperty({ description: 'Average recoverable Epsom salt in kg' })
  potential_epsom_salt: number;

  @ApiProperty({ description: 'Average recoverable potash in kg' })
  potential_potash: number;

  @ApiProperty({ description: 'Average recoverable magnesium oil in L' })
  potential_magnesium_oil: number;

  @ApiProperty({ description: 'Average total liquid waste in L' })
  total_liquid_waste: number;
  waste_to_production_ratio_percent?: number | null;
  solid_waste_percentage_percent?: number | null;
  valorization_potential?: number | null;
}

export class GetWastePredictionsResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response data' })
  data: {
    predictions: WastePredictionEntry[];
    averages?: WasteAverages;
  };

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;
}

// gRPC DTOs
export class GetWastePredictionsGrpcDto {
  startDate?: string;
  endDate?: string;
  includeAverages?: boolean;
  userId?: string; // For future filtering by user
}

export class GetWastePredictionsGrpcResponseDto {
  success: boolean;
  data: string; // JSON stringified data
  timestamp: string;
  message?: string;
}

// Monthly prediction DTOs
export class WastePredictionMonthlyEntry {
  month: string; // YYYY-MM
  predicted_waste: number;
  production_volume: number;
  rain_sum: number;
  temperature_mean: number;
  humidity_mean: number;
  wind_speed_mean: number;
  type: 'historical' | 'predicted';
  solid_waste_gypsum: number;
  solid_waste_limestone: number;
  solid_waste_industrial_salt: number;
  total_solid_waste: number;
  liquid_waste_bittern: number;
  potential_epsom_salt: number;
  potential_potash: number;
  potential_magnesium_oil: number;
  total_liquid_waste: number;
  // Computed metrics
  waste_to_production_ratio_percent?: number | null;
  solid_waste_percentage_percent?: number | null;
  valorization_potential?: number | null;
}

export class GetWasteMonthlyPredictionsGrpcDto {
  startDate?: string;
  endDate?: string;
  includeAverages?: boolean;
  userId?: string;
}

export class GetWasteMonthlyPredictionsGrpcResponseDto {
  success: boolean;
  data: string; // JSON stringified data
  timestamp: string;
  message?: string;
}

// Quick Prediction DTOs
export class QuickPredictionDto {
  @ApiProperty({ description: 'Production volume in kg', example: 50000 })
  production_volume: number;

  @ApiProperty({ description: 'Rain sum in mm', example: 200 })
  rain_sum: number;

  @ApiProperty({ description: 'Mean temperature in Celsius', example: 28 })
  temperature_mean: number;

  @ApiProperty({ description: 'Mean humidity percentage', example: 85 })
  humidity_mean: number;

  @ApiProperty({ description: 'Mean wind speed in km/h', example: 15 })
  wind_speed_mean: number;
}

export class QuickPredictionResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Job creation data with jobId and status' })
  data: {
    jobId: string;
    status: string;
    message?: string;
  };

  @ApiProperty({ description: 'Response timestamp' })
  timestamp: string;
}

export class QuickPredictionGrpcDto {
  production_volume: number;
  rain_sum: number;
  temperature_mean: number;
  humidity_mean: number;
  wind_speed_mean: number;
}

export class QuickPredictionGrpcResponseDto {
  success: boolean;
  data: string; // JSON stringified data
  timestamp: string;
  message?: string;
}
