import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

// Request DTOs
export class CreateActualMonthlyProductionDto {
  @ApiProperty({ example: '2023-10', description: 'Month in YYYY-MM format' })
  @IsString()
  month: string;

  @ApiProperty({ example: 20177.6, description: 'Production volume in metric tons' })
  @IsNumber()
  production_volume: number;

  @ApiProperty({ example: 'Maha', description: 'Season (Maha or Yala)' })
  @IsString()
  season: string;
}

export class UpdateActualMonthlyProductionDto {
  @ApiProperty({ example: 21000, description: 'Production volume in metric tons', required: false })
  @IsNumber()
  @IsOptional()
  production_volume?: number;

  @ApiProperty({ example: 'Yala', description: 'Season (Maha or Yala)', required: false })
  @IsString()
  @IsOptional()
  season?: string;
}

// Response DTOs
export class ActualMonthlyProductionData {
  @ApiProperty({ example: '694cea7dddfc3a10dca5f020' })
  _id: string;

  @ApiProperty({ example: '2023-10' })
  month: string;

  @ApiProperty({ example: 20177.6 })
  production_volume: number;

  @ApiProperty({ example: 'Maha' })
  season: string;

  @ApiProperty({ example: '2023-10-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2023-10-01T00:00:00.000Z' })
  updatedAt: string;
}

export class CreateActualMonthlyProductionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly production created/updated successfully' })
  message: string;

  @ApiProperty({ type: ActualMonthlyProductionData, required: false })
  data?: ActualMonthlyProductionData;
}

export class UpdateActualMonthlyProductionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly production updated successfully' })
  message: string;

  @ApiProperty({ type: ActualMonthlyProductionData, required: false })
  data?: ActualMonthlyProductionData;
}

export class GetActualMonthlyProductionByRangeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly productions fetched successfully' })
  message: string;

  @ApiProperty({ type: [ActualMonthlyProductionData] })
  data: ActualMonthlyProductionData[];
}

export class GetActualMonthlyProductionByIdResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly production fetched successfully' })
  message: string;

  @ApiProperty({ type: ActualMonthlyProductionData, required: false })
  data?: ActualMonthlyProductionData;
}

export class GetActualMonthlyProductionByMonthResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly production fetched successfully' })
  message: string;

  @ApiProperty({ type: ActualMonthlyProductionData, required: false })
  data?: ActualMonthlyProductionData;
}

export class DeleteActualMonthlyProductionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Actual monthly production deleted successfully' })
  message: string;
}
