import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ description: 'Plan key', example: 'pro', enum: ['pro', 'lab'] })
  @IsString()
  planKey: string;

  @ApiProperty({ description: 'Billing cycle', example: 'monthly', enum: ['monthly', 'annual'] })
  @IsString()
  @IsIn(['monthly', 'annual'])
  billingCycle: string;
}
