import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum JobType {
  WASTE_PREDICTION = 'WASTE_PREDICTION',
  VALORIZATION_ANALYSIS = 'VALORIZATION_ANALYSIS',
  OPTIMIZATION = 'OPTIMIZATION',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class CreateJobDto {
  @ApiProperty({ description: 'Type of job', enum: JobType })
  @IsEnum(JobType)
  @IsNotEmpty()
  jobType: JobType;

  @ApiProperty({ description: 'Prediction date in ISO format (YYYY-MM-DD)', example: '2026-02-01' })
  @IsDateString()
  @IsNotEmpty()
  predictionDate: string;

  @ApiPropertyOptional({ description: 'Optional: user id (server will use authenticated user if present)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Request data object', example: { production_volume: 50000, rain_sum: 200, temperature_mean: 28, humidity_mean: 85, wind_speed_mean: 15, month: 6 } })
  @IsObject()
  @IsNotEmpty()
  requestData: Record<string, unknown>;
}

export class UpdateJobDto {
  @ApiPropertyOptional({ description: 'Job status', enum: JobStatus })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiPropertyOptional({ description: 'Prediction date in ISO format (YYYY-MM-DD)', example: '2026-02-01' })
  @IsDateString()
  @IsOptional()
  predictionDate?: string;

  @ApiPropertyOptional({ description: 'Result data object', example: { result: 'value' } })
  @IsObject()
  @IsOptional()
  resultData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Error message if job failed' })
  @IsString()
  @IsOptional()
  errorMessage?: string;
}

export class GetJobsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by job status', enum: JobStatus })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiPropertyOptional({ description: 'Filter by job type', enum: JobType })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', default: 10 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;
}

export interface JobResponseData {
  _id: string;
  userId: string;
  jobType: number;
  status: number;
  predictionDate: string;
  requestData: string;
  resultData?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export class CreateJobResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: JobResponseData;
}

export class GetJobResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: JobResponseData;
}

export class GetJobsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: JobResponseData[];

  @ApiPropertyOptional()
  total?: number;

  @ApiPropertyOptional()
  page?: number;

  @ApiPropertyOptional()
  limit?: number;
}

export class UpdateJobResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: JobResponseData;
}

export class GetJobStatusResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  jobId?: string;

  @ApiPropertyOptional()
  status?: number;

  @ApiPropertyOptional()
  resultData?: string;

  @ApiPropertyOptional()
  errorMessage?: string;
}
