import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DetectionFilterDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Start date filter (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Minimum purity percentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPurity?: number;

  @ApiPropertyOptional({ description: 'Maximum purity percentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPurity?: number;

  @ApiPropertyOptional({ description: 'Filter by session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class BatchFilterDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by session ID' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class StatsSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Data source: "detections" or "batches"', default: 'detections' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class StatsHourlyQueryDto {
  @ApiPropertyOptional({ description: 'Date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Data source: "detections" or "batches"', default: 'detections' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class StatsDailyQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Max number of days', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Data source: "detections" or "batches"', default: 'detections' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class StatsTrendsQueryDto {
  @ApiPropertyOptional({ description: 'Period: hourly, daily, or weekly', default: 'daily' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Number of data points', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
