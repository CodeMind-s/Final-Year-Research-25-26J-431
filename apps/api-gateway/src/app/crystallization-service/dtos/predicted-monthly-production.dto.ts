import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GetPredictedMonthlyProductionDto {
  @ApiProperty({
    description: 'Start month in YYYY-MM format',
    example: '2025-06'
  })
  @IsString()
  @IsNotEmpty()
  startMonth: string;

  @ApiProperty({
    description: 'End month in YYYY-MM format',
    example: '2025-12'
  })
  @IsString()
  @IsNotEmpty()
  endMonth: string;
}

export class GetPredictedMonthlyProductionResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Predicted monthly production data', type: [Object] })
  data?: any[];
}
