import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'basic', enum: ['basic', 'premium'], description: 'Plan tier' })
  @IsEnum(['basic', 'premium'], { message: 'Plan must be basic or premium' })
  plan: string;

  @ApiProperty({ example: 'user123', description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({ example: true, description: 'Success flag' })
  success: boolean;

  @ApiProperty({ example: 'Subscription created', description: 'Message' })
  message: string;

  @ApiProperty({ example: { url: 'https://checkout.stripe.com/...' }, description: 'Stripe checkout URL or session' })
  data: any;
}