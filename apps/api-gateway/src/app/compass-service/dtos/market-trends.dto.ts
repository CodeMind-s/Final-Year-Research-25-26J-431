import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

// Get Market Demand Trends
export class GetMarketDemandTrendsDto {
  @ApiProperty({ example: 6 })
  @IsNumber()
  months: number;

  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;
}

export class GetMarketDemandTrendsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  trends?: Array<{
    month: string;
    demand: number;
  }>;

  @ApiPropertyOptional()
  currentDemand?: number;

  @ApiPropertyOptional()
  trend?: string;
}
