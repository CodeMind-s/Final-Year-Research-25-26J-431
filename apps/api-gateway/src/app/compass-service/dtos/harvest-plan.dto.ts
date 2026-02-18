import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum HarvestStatus {
  FRESHER = 'FRESHER',
  MIDLEVEL = 'MIDLEVEL',
  HARVESTED = 'HARVESTED',
}

export class CreatePlanDto {

  @ApiProperty({ example: 'user123', description: 'User ID (should be extracted from JWT in production)' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 5, description: 'Number of salt beds (integer count)' })
  @IsNumber()
  saltBeds: number;

  @ApiProperty({ enum: HarvestStatus, example: HarvestStatus.FRESHER, description: 'Harvest status' })
  @IsEnum(HarvestStatus)
  harvestStatus: HarvestStatus;

  @ApiProperty({ example: 45, description: 'Plan period in days (typically 45)' })
  @IsNumber()
  planPeriod: number;

  @ApiProperty({ example: '2026-02-15T00:00:00Z', description: 'Start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: 1000, description: 'Predicted production', required: false })
  @IsOptional()
  @IsNumber()
  predictedProduction?: number;

  @ApiProperty({ example: 0, description: 'Actual production', required: false })
  @IsOptional()
  @IsNumber()
  actualProduction?: number;

  @ApiProperty({ example: 5, description: 'Worker count', required: false })
  @IsOptional()
  @IsNumber()
  workerCount?: number;

  @ApiProperty({ example: 50000, description: 'Predicted profit', required: false })
  @IsOptional()
  @IsNumber()
  predictedProfit?: number;

  @ApiProperty({ example: 0, description: 'Actual profit', required: false })
  @IsOptional()
  @IsNumber()
  actualProfit?: number;

  @ApiProperty({ example: 0, description: 'Expenses', required: false })
  @IsOptional()
  @IsNumber()
  expenses?: number;

  @ApiProperty({ example: 0, description: 'Earnings', required: false })
  @IsOptional()
  @IsNumber()
  earnings?: number;

  @ApiProperty({ example: 50, description: 'Average selling price', required: false })
  @IsOptional()
  @IsNumber()
  avgSellingPrice?: number;
}

export class UpdatePlanDto {
  @ApiProperty({ example: 8, description: 'Number of salt beds (integer count)', required: false })
  saltBeds?: number;

  @ApiProperty({ enum: HarvestStatus, example: HarvestStatus.HARVESTED, description: 'Harvest status', required: false })
  harvestStatus?: HarvestStatus;

  @ApiProperty({ example: 45, description: 'Plan period in days (typically 45)', required: false })
  planPeriod?: number;

  @ApiProperty({ example: '2026-02-15T00:00:00Z', description: 'Start date', required: false })
  startDate?: string;

  @ApiProperty({ example: 1200, description: 'Predicted production', required: false })
  predictedProduction?: number;

  @ApiProperty({ example: 950, description: 'Actual production', required: false })
  actualProduction?: number;

  @ApiProperty({ example: 8, description: 'Worker count', required: false })
  workerCount?: number;

  @ApiProperty({ example: 60000, description: 'Predicted profit', required: false })
  predictedProfit?: number;

  @ApiProperty({ example: 47500, description: 'Actual profit', required: false })
  actualProfit?: number;

  @ApiProperty({ example: 12500, description: 'Expenses', required: false })
  expenses?: number;

  @ApiProperty({ example: 60000, description: 'Earnings', required: false })
  earnings?: number;

  @ApiProperty({ example: 63, description: 'Average selling price', required: false })
  avgSellingPrice?: number;
}

export class CreatePlanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan created successfully' })
  message: string;

  @ApiProperty({ required: false })
  data?: any;
}

export class GetPlanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan retrieved successfully' })
  message: string;

  @ApiProperty({ required: false })
  data?: any;
}

export class GetPlansResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Harvest plans retrieved successfully' })
  message: string;

  @ApiProperty({ required: false, type: [Object] })
  data?: any[];
}

export class UpdatePlanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan updated successfully' })
  message: string;

  @ApiProperty({ required: false })
  data?: any;
}

export class DeletePlanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan deleted successfully' })
  message: string;
}
