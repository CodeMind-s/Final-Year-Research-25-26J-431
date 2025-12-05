import { IsString, IsNumber, IsObject, ValidateNested, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CurrentValuesDto {
  @ApiProperty({ example: 28.5, description: 'Water temperature in degrees Celsius' })
  @IsNumber()
  water_temperature: number;

  @ApiProperty({ example: 2, description: 'Lagoon level' })
  @IsNumber()
  lagoon: number;

  @ApiProperty({ example: 4.5, description: 'Outer Ring brine level' })
  @IsNumber()
  OR_brine_level: number;

  @ApiProperty({ example: 1.5, description: 'Outer Ring bund level' })
  @IsNumber()
  OR_bund_level: number;

  @ApiProperty({ example: 5.5, description: 'Inner Ring brine level' })
  @IsNumber()
  IR_brine_level: number;

  @ApiProperty({ example: 1.5, description: 'Inner Ring bound level' })
  @IsNumber()
  IR_bound_level: number;

  @ApiProperty({ example: 7, description: 'East channel level' })
  @IsNumber()
  East_channel: number;

  @ApiProperty({ example: 6.5, description: 'West channel level' })
  @IsNumber()
  West_channel: number;
}

export class PredictionRequestDto {
  @ApiProperty({ example: '2025-12-05', description: 'Start date for predictions (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty({ message: 'start_date is required and cannot be empty' })
  start_date: string;

  @ApiProperty({ example: 60, description: 'Number of days to forecast' })
  @IsInt()
  @Min(1, { message: 'forecast_days must be at least 1' })
  forecast_days: number;

  @ApiProperty({ type: CurrentValuesDto, description: 'Current parameter values' })
  @ValidateNested()
  @Type(() => CurrentValuesDto)
  @IsObject()
  current_values: CurrentValuesDto;
}
