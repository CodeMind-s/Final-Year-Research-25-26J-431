import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GetPredictedDailyMeasurementDto {
  @ApiProperty({
    description: 'Start date in YYYY-MM-DD format',
    example: '2025-12-01'
  })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    description: 'End date in YYYY-MM-DD format',
    example: '2025-12-31'
  })
  @IsString()
  @IsNotEmpty()
  endDate: string;
}

export class GetPredictedDailyMeasurementResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Predicted daily measurement data', type: [Object] })
  data?: any[];
}
