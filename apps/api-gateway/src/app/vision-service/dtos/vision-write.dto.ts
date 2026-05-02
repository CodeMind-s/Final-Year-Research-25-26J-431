import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ROIDto {
  @ApiProperty({ description: 'X (0-1 normalized)' })
  @Type(() => Number)
  @IsNumber()
  x!: number;

  @ApiProperty({ description: 'Y (0-1 normalized)' })
  @Type(() => Number)
  @IsNumber()
  y!: number;

  @ApiProperty({ description: 'Width (0-1 normalized)' })
  @Type(() => Number)
  @IsNumber()
  width!: number;

  @ApiProperty({ description: 'Height (0-1 normalized)' })
  @Type(() => Number)
  @IsNumber()
  height!: number;
}

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Camera source identifier (e.g., USB device id)' })
  @IsOptional()
  @IsString()
  cameraSource?: string;

  @ApiPropertyOptional({ description: 'Region of interest', type: ROIDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ROIDto)
  roi?: ROIDto;
}

export class CreateBatchDto {
  @ApiProperty({ description: 'Session ID this batch belongs to' })
  @IsString()
  sessionId!: string;

  @ApiPropertyOptional({ description: 'Region of interest', type: ROIDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ROIDto)
  roi?: ROIDto;
}

export class BoundingBoxInputDto {
  @Type(() => Number) @IsNumber() x!: number;
  @Type(() => Number) @IsNumber() y!: number;
  @Type(() => Number) @IsNumber() width!: number;
  @Type(() => Number) @IsNumber() height!: number;

  @Type(() => Number) @IsInt() @Min(0) classId!: number;

  @IsString() className!: string;

  @Type(() => Number) @IsNumber() confidence!: number;

  @IsOptional() @Type(() => Number) @IsNumber() whitenessPercentage?: number;
  @IsOptional() @Type(() => Number) @IsNumber() qualityScore?: number;
}

export class SaveDetectionDto {
  @ApiPropertyOptional({ description: 'Session this detection belongs to' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Batch this detection belongs to' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  frameWidth!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  frameHeight!: number;

  @ApiProperty({ description: 'Inference time on the agent (ms)' })
  @Type(() => Number)
  @IsNumber()
  processingTimeMs!: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roiPureCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roiImpureCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roiUnwantedCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roiTotalCount?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() roiPurityPercentage?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() avgWhiteness?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() avgQualityScore?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() roiAvgWhiteness?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() roiAvgQualityScore?: number;

  @ApiProperty({ type: [BoundingBoxInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoundingBoxInputDto)
  boundingBoxes!: BoundingBoxInputDto[];
}
