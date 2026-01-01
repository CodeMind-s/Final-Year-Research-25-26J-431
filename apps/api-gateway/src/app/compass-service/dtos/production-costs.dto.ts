import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

// Update Production Costs
export class UpdateProductionCostsDto {
  @ApiProperty({ example: 'landowner123' })
  @IsString()
  landownerId: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  fertilizerCost: number;

  @ApiProperty({ example: 3000 })
  @IsNumber()
  laborCost: number;

  @ApiProperty({ example: 2000 })
  @IsNumber()
  transportCost: number;
}

export class UpdateProductionCostsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  costs?: {
    fertilizerCost: number;
    laborCost: number;
    transportCost: number;
  };
}
