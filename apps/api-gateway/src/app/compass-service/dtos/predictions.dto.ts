import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Common DTOs
export class MonthDataDto {
  @ApiProperty({ example: '2025-01' })
  @IsString()
  month: string;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  tons: number;
}

export class PriceDataDto {
  @ApiProperty({ example: '2025-01' })
  @IsString()
  month: string;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  avgPrice: number;
}

// Get Price Prediction
export class GetPricePredictionDto {
  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;

  @ApiProperty({ type: [PriceDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDataDto)
  historicalPrices: PriceDataDto[];
}

export class GetPricePredictionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  predictions?: Array<{
    month: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    isPrediction: boolean;
  }>;

  @ApiPropertyOptional()
  historicalData?: Array<{
    month: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    isPrediction: boolean;
  }>;
}

// Get Demand Prediction
export class GetDemandPredictionDto {
  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;

  @ApiProperty({ example: 'Sea Salt' })
  @IsString()
  productType: string;
}

export class GetDemandPredictionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  predictions?: Array<{
    month: string;
    demandTons: number;
    isPrediction: boolean;
    trend: string;
  }>;

  @ApiPropertyOptional()
  historicalData?: Array<{
    month: string;
    demandTons: number;
    isPrediction: boolean;
    trend: string;
  }>;
}
