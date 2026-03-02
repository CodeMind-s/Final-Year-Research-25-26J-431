import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, IsNumber, Min } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Optional: user id (server will use authenticated user if present)' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ description: 'Request data object', example: { param1: 'value1' } })
  @IsObject()
  @IsNotEmpty()
  requestData: Record<string, unknown>;
}

export class UpdateJobDto {
  @ApiPropertyOptional({ description: 'Job status', enum: JobStatus })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

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

  @ApiPropertyOptional({ description: 'Filter by job type (numeric)', example: 0 })
  @ApiPropertyOptional({ description: 'Filter by job type', enum: JobType })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', default: 10 })
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
