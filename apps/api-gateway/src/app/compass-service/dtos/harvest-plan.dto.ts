import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsDateString, IsOptional } from 'class-validator';

export enum HarvestStatus {
  FRESHER = 'FRESHER',
  MIDLEVEL = 'MIDLEVEL',
  HARVESTED = 'HARVESTED',
  DISPOSED = 'DISPOSED',
}

export class CreatePlanDto {

  @ApiProperty({ example: 5, description: 'Number of salt beds (integer count)' })
  @IsNumber()
  saltBeds: number;

  @ApiProperty({ enum: HarvestStatus, example: HarvestStatus.FRESHER, description: 'Harvest status' })
  @IsEnum(HarvestStatus)
  harvestStatus: HarvestStatus;

  @ApiProperty({ example: 45, description: 'Plan period in days (typically 45)' })
  @IsNumber()
  planPeriod: number;

  @ApiProperty({ example: '2026-02-15T00:00:00Z', description: 'Start date (end date will be calculated based on planPeriod)' })
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
  @IsOptional()
  @IsNumber()
  saltBeds?: number;

  @ApiProperty({ enum: HarvestStatus, example: HarvestStatus.HARVESTED, description: 'Harvest status', required: false })
  @IsOptional()
  @IsEnum(HarvestStatus)
  harvestStatus?: HarvestStatus;

  @ApiProperty({ example: 45, description: 'Plan period in days (typically 45)', required: false })
  @IsOptional()
  @IsNumber()
  planPeriod?: number;

  @ApiProperty({ example: '2026-02-15T00:00:00Z', description: 'Start date (end date will be recalculated if changed)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: 1200, description: 'Predicted production', required: false })
  @IsOptional()
  @IsNumber()
  predictedProduction?: number;

  @ApiProperty({ example: 950, description: 'Actual production', required: false })
  @IsOptional()
  @IsNumber()
  actualProduction?: number;

  @ApiProperty({ example: 8, description: 'Worker count', required: false })
  @IsOptional()
  @IsNumber()
  workerCount?: number;

  @ApiProperty({ example: 60000, description: 'Predicted profit', required: false })
  @IsOptional()
  @IsNumber()
  predictedProfit?: number;

  @ApiProperty({ example: 47500, description: 'Actual profit', required: false })
  @IsOptional()
  @IsNumber()
  actualProfit?: number;

  @ApiProperty({ example: 12500, description: 'Expenses', required: false })
  @IsOptional()
  @IsNumber()
  expenses?: number;

  @ApiProperty({ example: 60000, description: 'Earnings', required: false })
  @IsOptional()
  @IsNumber()
  earnings?: number;

  @ApiProperty({ example: 63, description: 'Average selling price', required: false })
  @IsOptional()
  @IsNumber()
  avgSellingPrice?: number;
}

export class CreatePlanResponseDto {
  @ApiProperty({ example: true, description: 'Indicates if the operation was successful' })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan created successfully', description: 'Response message' })
  message: string;

  @ApiProperty({ 
    required: false, 
    description: 'Created harvest plan data',
    example: {
      _id: '675945c5d1234567890abcde',
      userId: 'user123',
      saltBeds: 5,
      harvestStatus: 0,
      planPeriod: 45,
      startDate: '2026-02-15T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      predictedProduction: 1000,
      actualProduction: 0,
      workerCount: 5,
      predictedProfit: 50000,
      actualProfit: 0,
      expenses: 0,
      earnings: 0,
      avgSellingPrice: 50,
      createdAt: '2026-02-15T10:30:00.000Z',
      updatedAt: '2026-02-15T10:30:00.000Z'
    }
  })
  data?: any;
}

export class GetPlanResponseDto {
  @ApiProperty({ example: true, description: 'Indicates if the operation was successful' })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan retrieved successfully', description: 'Response message' })
  message: string;

  @ApiProperty({ 
    required: false, 
    description: 'Retrieved harvest plan data',
    example: {
      _id: '675945c5d1234567890abcde',
      userId: 'user123',
      saltBeds: 5,
      harvestStatus: 0,
      planPeriod: 45,
      startDate: '2026-02-15T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      predictedProduction: 1000,
      actualProduction: 950,
      workerCount: 5,
      predictedProfit: 50000,
      actualProfit: 47500,
      expenses: 12500,
      earnings: 60000,
      avgSellingPrice: 63,
      createdAt: '2026-02-15T10:30:00.000Z',
      updatedAt: '2026-03-31T15:45:00.000Z'
    }
  })
  data?: any;
}

export class GetPlansResponseDto {
  @ApiProperty({ example: true, description: 'Indicates if the operation was successful' })
  success: boolean;

  @ApiProperty({ example: 'Harvest plans retrieved successfully', description: 'Response message' })
  message: string;

  @ApiProperty({ 
    required: false, 
    type: [Object],
    description: 'Array of harvest plans',
    example: [{
      _id: '675945c5d1234567890abcde',
      userId: 'user123',
      saltBeds: 5,
      harvestStatus: 2,
      planPeriod: 45,
      startDate: '2026-02-15T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      predictedProduction: 1000,
      actualProduction: 950,
      workerCount: 5,
      predictedProfit: 50000,
      actualProfit: 47500,
      expenses: 12500,
      earnings: 60000,
      avgSellingPrice: 63,
      createdAt: '2026-02-15T10:30:00.000Z',
      updatedAt: '2026-03-31T15:45:00.000Z'
    }]
  })
  data?: any[];
}

export class UpdatePlanResponseDto {
  @ApiProperty({ example: true, description: 'Indicates if the operation was successful' })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan updated successfully', description: 'Response message' })
  message: string;

  @ApiProperty({ 
    required: false, 
    description: 'Updated harvest plan data',
    example: {
      _id: '675945c5d1234567890abcde',
      userId: 'user123',
      saltBeds: 8,
      harvestStatus: 2,
      planPeriod: 45,
      startDate: '2026-02-15T00:00:00.000Z',
      endDate: '2026-04-01T00:00:00.000Z',
      predictedProduction: 1200,
      actualProduction: 950,
      workerCount: 8,
      predictedProfit: 60000,
      actualProfit: 47500,
      expenses: 12500,
      earnings: 60000,
      avgSellingPrice: 63,
      createdAt: '2026-02-15T10:30:00.000Z',
      updatedAt: '2026-03-31T16:00:00.000Z'
    }
  })
  data?: any;
}

export class DeletePlanResponseDto {
  @ApiProperty({ example: true, description: 'Indicates if the operation was successful' })
  success: boolean;

  @ApiProperty({ example: 'Harvest plan deleted successfully', description: 'Response message' })
  message: string;
}
