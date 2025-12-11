import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDailyMeasurementDto {
  @ApiProperty({ example: '2025-12-05', description: 'Date' })
  @IsString({ message: 'Date must be a string' })
  @IsNotEmpty({ message: 'Date cannot be empty' })
  date: string;

  @ApiProperty({ example: 28.5, description: 'Water Temperature' })
  @IsNumber({}, { message: 'Water Temperature must be a number' })
  @IsOptional()
  waterTemperature: number;

  @ApiProperty({ example: 2, description: 'Lagoon' })
  @IsNumber({}, { message: 'Lagoon must be a number' })
  @IsNotEmpty({ message: 'Lagoon cannot be empty' })
  lagoon: number;

  @ApiProperty({ example: 2, description: 'OR Brine Level' })
  @IsNumber({}, { message: 'OR Brine Level must be a number' })
  @IsOptional()
  orBrineLevel: number;

  @ApiProperty({ example: 2, description: 'OR Bund Level' })
  @IsNumber({}, { message: 'OR Bund Level must be a number' })
  @IsOptional()
  orBoundLevel: number;

  @ApiProperty({ example: 2, description: 'IR Brine Level' })
  @IsNumber({}, { message: 'IR Brine Level must be a number' })
  @IsOptional()
  irBrineLevel: number;

  @ApiProperty({ example: 2, description: 'IR Bund Level' })
  @IsNumber({}, { message: 'IR Bund Level must be a number' })
  @IsOptional()
  irBoundLevel: number;

  @ApiProperty({ example: 2, description: 'East Channel' })
  @IsNumber({}, { message: 'East Channel must be a number' })
  @IsOptional()
  eastChannel: number;

  @ApiProperty({ example: 2, description: 'West Channel' })
  @IsNumber({}, { message: 'West Channel must be a number' })
  @IsOptional()
  westChannel: number;
}

export class DailyMeasurementDataDto {
  @ApiProperty({ example: '2025-12-05', description: 'Date' })
  date: string;

  @ApiProperty({ example: 28.5, description: 'Water Temperature' })
  waterTemperature: number;

  @ApiProperty({ example: 2, description: 'Lagoon' })
  lagoon: number;

  @ApiProperty({ example: 232, description: 'OR Brine Level' })
  orBrineLevel: number;

  @ApiProperty({ example: 45, description: 'OR Bund Level' })
  orBoundLevel: number;

  @ApiProperty({ example: 52, description: 'IR Brine Level' })
  irBrineLevel: number;

  @ApiProperty({ example: 27, description: 'IR Bund Level' })
  irBoundLevel: number;

  @ApiProperty({ example: 28, description: 'East Channel' })
  eastChannel: number;

  @ApiProperty({ example: 288, description: 'West Channel' })
  westChannel: number;

  @ApiProperty({ example: '675945c5d1234567890abcde', description: 'ID' })
  _id?: string;

  @ApiProperty({ example: '2025-12-05T12:00:00Z', description: 'Created At' })
  createdAt?: string;

  @ApiProperty({ example: '2025-12-05T12:00:00Z', description: 'Updated At' })
  updatedAt?: string;
}

export class CreateDailyMeasurementResponseDto {
  @ApiProperty({ example: true, description: 'Success flag' })
  success: boolean;

  @ApiProperty({ example: 'Daily Measurement created successfully', description: 'Message' })
  message: string;

  @ApiProperty({ type: DailyMeasurementDataDto, description: 'Daily Measurement data' })
  data?: DailyMeasurementDataDto;
}