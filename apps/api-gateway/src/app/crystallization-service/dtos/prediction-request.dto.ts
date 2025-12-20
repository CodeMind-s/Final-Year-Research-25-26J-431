import { IsString, IsNumber, IsObject, ValidateNested, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CurrentValuesDto {
  @ApiProperty({ example: 28.5, description: 'Water temperature in degrees Celsius' })
  @IsNumber()
  waterTemperature: number;

  @ApiProperty({ example: 2, description: 'Lagoon level' })
  @IsNumber()
  lagoon: number;

  @ApiProperty({ example: 4.5, description: 'Outer Ring brine level' })
  @IsNumber()
  orBrineLevel: number;

  @ApiProperty({ example: 1.5, description: 'Outer Ring bund level' })
  @IsNumber()
  orBoundLevel: number;

  @ApiProperty({ example: 5.5, description: 'Inner Ring brine level' })
  @IsNumber()
  irBrineLevel: number;

  @ApiProperty({ example: 1.5, description: 'Inner Ring bound level' })
  @IsNumber()
  irBoundLevel: number;

  @ApiProperty({ example: 7, description: 'East channel level' })
  @IsNumber()
  eastChannel: number;

  @ApiProperty({ example: 6.5, description: 'West channel level' })
  @IsNumber()
  westChannel: number;
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
