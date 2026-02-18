import { IsOptional, IsString, IsNumber, IsBoolean, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ROIDto {
  @ApiProperty({ description: 'Top-left X (normalized 0-1)', example: 0.05 })
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @ApiProperty({ description: 'Top-left Y (normalized 0-1)', example: 0.05 })
  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @ApiProperty({ description: 'Width (normalized 0-1)', example: 0.9 })
  @IsNumber()
  @Min(0)
  @Max(1)
  width: number;

  @ApiProperty({ description: 'Height (normalized 0-1)', example: 0.9 })
  @IsNumber()
  @Min(0)
  @Max(1)
  height: number;
}

export class StartStreamDto {
  @ApiPropertyOptional({ description: 'Camera source identifier' })
  @IsOptional()
  @IsString()
  cameraSource?: string;

  @ApiPropertyOptional({ description: 'Region of interest', type: ROIDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ROIDto)
  roi?: ROIDto;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Whether to save detections to DB' })
  @IsOptional()
  @IsBoolean()
  saveDetections?: boolean;

  @ApiPropertyOptional({ description: 'Confidence threshold for detections', example: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;
}
