import { IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetWastePredictionsQueryDto {
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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return true;
  })
  includeAverages?: boolean;
}

export class WastePredictionEntry {
  @ApiProperty({ description: 'Date in ISO format (YYYY-MM-DD)', example: '2026-03-03' })
  date: string;

  @ApiProperty({ description: 'Predicted waste in kg', example: 4250 })
  predicted_waste: number;

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

  @ApiProperty({ description: 'Type of entry', enum: ['historical', 'predicted'], example: 'historical' })
  type: 'historical' | 'predicted';

  // Solid waste breakdown
  @ApiProperty({ description: 'Gypsum waste in kg', example: 850 })
  solid_waste_gypsum: number;

  @ApiProperty({ description: 'Limestone residue in kg', example: 620 })
  solid_waste_limestone: number;

  @ApiProperty({ description: 'Low-grade industrial salt in kg', example: 430 })
  solid_waste_industrial_salt: number;

  @ApiProperty({ description: 'Total solid waste in kg', example: 1900 })
  total_solid_waste: number;

  // Liquid waste breakdown
  @ApiProperty({ description: 'Bittern waste brine in L', example: 750 })
  liquid_waste_bittern: number;

  @ApiProperty({ description: 'Recoverable Epsom salt (MgSO4) in kg', example: 120 })
  potential_epsom_salt: number;

  @ApiProperty({ description: 'Recoverable potash (K2O) in kg', example: 85 })
  potential_potash: number;

  @ApiProperty({ description: 'Recoverable magnesium oil in L', example: 45 })
  potential_magnesium_oil: number;

  @ApiProperty({ description: 'Total liquid waste in L', example: 1000 })
  total_liquid_waste: number;
}

export class WasteAverages {
  @ApiProperty({ description: 'Average production volume', example: 50000 })
  production_volume: number;

  @ApiProperty({ description: 'Average rain sum', example: 200 })
  rain_sum: number;

  @ApiProperty({ description: 'Average temperature', example: 28 })
  temperature_mean: number;

  @ApiProperty({ description: 'Average humidity', example: 85 })
  humidity_mean: number;

  @ApiProperty({ description: 'Average wind speed', example: 15 })
  wind_speed_mean: number;

  @ApiProperty({ description: 'Average predicted waste', example: 4250 })
  predicted_waste: number;

  // Solid waste breakdown averages
  @ApiProperty({ description: 'Average gypsum waste in kg', example: 820 })
  solid_waste_gypsum: number;

  @ApiProperty({ description: 'Average limestone residue in kg', example: 600 })
  solid_waste_limestone: number;

  @ApiProperty({ description: 'Average low-grade industrial salt in kg', example: 410 })
  solid_waste_industrial_salt: number;

  @ApiProperty({ description: 'Average total solid waste in kg', example: 1830 })
  total_solid_waste: number;

  // Liquid waste breakdown averages
  @ApiProperty({ description: 'Average bittern waste brine in L', example: 730 })
  liquid_waste_bittern: number;

  @ApiProperty({ description: 'Average recoverable Epsom salt in kg', example: 115 })
  potential_epsom_salt: number;

  @ApiProperty({ description: 'Average recoverable potash in kg', example: 80 })
  potential_potash: number;

  @ApiProperty({ description: 'Average recoverable magnesium oil in L', example: 42 })
  potential_magnesium_oil: number;

  @ApiProperty({ description: 'Average total liquid waste in L', example: 967 })
  total_liquid_waste: number;
}

export class GetWastePredictionsResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Response data' })
  data: {
    predictions: WastePredictionEntry[];
    averages?: WasteAverages;
  };

  @ApiProperty({ description: 'Response timestamp', example: '2026-03-03T10:00:00Z' })
  timestamp: string;
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
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Job creation data with jobId and status',
    example: {
      jobId: '65f8a1b2c3d4e5f6a7b8c9d0',
      status: 'PENDING',
      message: 'Prediction job created successfully. Use the jobId to check status and retrieve results.'
    }
  })
  data: {
    jobId: string;
    status: string;
    message?: string;
  };

  @ApiProperty({ description: 'Response timestamp', example: '2026-03-04T10:00:00Z' })
  timestamp: string;
}
