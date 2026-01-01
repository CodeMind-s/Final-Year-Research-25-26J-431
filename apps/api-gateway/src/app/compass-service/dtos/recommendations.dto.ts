import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

// Get Seller Recommendations (for landowners)
export class GetSellerRecommendationsDto {
  @ApiProperty({ example: 'landowner123' })
  @IsString()
  landownerId: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  availableTons: number;

  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;
}

export class GetSellerRecommendationsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  recommendations?: Array<{
    seller_id: number;
    sellerName: string;
    confidence: number;
    confidence_percentage: string;
    ranking: number;
  }>;
}

// Get Available Landowners (for sellers)
export class GetAvailableLandownersResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  landowners?: Array<{
    id: string;
    name: string;
    productionTons: number;
    availableTons: number;
    harvestDate: string;
    priority: boolean;
  }>;
}
