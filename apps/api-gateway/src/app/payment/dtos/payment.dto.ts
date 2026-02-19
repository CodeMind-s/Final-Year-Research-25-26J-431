import { IsString, IsIn, IsOptional } from 'class-validator';
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

export class PayHereNotifyDto {
  @ApiProperty({ description: 'PayHere Merchant ID', example: '1228391' })
  @IsString()
  merchant_id: string;

  @ApiProperty({ description: 'Order ID from checkout', example: 'ORD-1234567890' })
  @IsString()
  order_id: string;

  @ApiProperty({ description: 'PayHere Payment ID', example: '320025071234' })
  @IsString()
  payment_id: string;

  @ApiProperty({ description: 'Payment amount', example: '1500.00' })
  @IsString()
  payhere_amount: string;

  @ApiProperty({ description: 'Payment currency', example: 'LKR' })
  @IsString()
  payhere_currency: string;

  @ApiProperty({ description: 'Status code (2=success, 0=pending, -1=canceled, -2=failed, -3=chargeback)', example: '2' })
  @IsString()
  status_code: string;

  @ApiProperty({ description: 'MD5 signature for verification', example: 'A1B2C3D4E5F6...' })
  @IsString()
  md5sig: string;

  @ApiProperty({ description: 'Payment method (optional)', example: 'VISA', required: false })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ description: 'Card holder name (optional)', example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  card_holder_name?: string;

  @ApiProperty({ description: 'Card number masked (optional)', example: '************1234', required: false })
  @IsOptional()
  @IsString()
  card_no?: string;

  @ApiProperty({ description: 'Card expiry (optional)', example: '12/25', required: false })
  @IsOptional()
  @IsString()
  card_expiry?: string;
}
