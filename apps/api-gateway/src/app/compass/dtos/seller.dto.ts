import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

// Get Seller Profile
export class GetSellerProfileResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  data?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    reliability: string;
    totalPurchased: number;
    activeCampaigns: number;
  };
}

// Get Market Demand Trends
export class GetMarketDemandTrendsDto {
  @ApiProperty({ example: 6 })
  @IsNumber()
  months: number;

  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;
}

export class GetMarketDemandTrendsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  trends?: Array<{
    month: string;
    demand: number;
  }>;

  @ApiPropertyOptional()
  currentDemand?: number;

  @ApiPropertyOptional()
  trend?: string;
}

// Create Offer
export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  sellerId: string;

  @ApiProperty()
  @IsString()
  sellerName: string;

  @ApiProperty()
  @IsNumber()
  pricePerTon: number;

  @ApiProperty()
  @IsNumber()
  demandTons: number;

  @ApiProperty({ example: 'High' })
  @IsString()
  reliability: string;

  @ApiProperty()
  @IsBoolean()
  isRecommended: boolean;
}

export class CreateOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  offerId?: string;
}

// Get Current Offer
export class GetCurrentOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  offer?: {
    id: string;
    sellerId: string;
    pricePerTon: number;
    demandTons: number;
    reliability: string;
    timestamp: number;
  };
}

// Update Offer
export class UpdateOfferDto {
  @ApiProperty()
  @IsNumber()
  pricePerTon: number;

  @ApiProperty()
  @IsNumber()
  demandTons: number;
}

export class UpdateOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  updatedOffer?: any;
}

// Delete Offer
export class DeleteOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

// Get Available Landowners
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

// Get Seller Deals
export class GetSellerDealsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  deals?: Array<{
    id: string;
    sellerId: string;
    sellerName: string;
    landownerId: string;
    landownerName: string;
    quantity: number;
    pricePerTon: number;
    totalPrice: number;
    status: string;
    createdAt: number;
    acceptedAt: number;
    completedAt: number;
  }>;

  @ApiPropertyOptional()
  securedTons?: number;

  @ApiPropertyOptional()
  remainingTons?: number;
}

// Get Deal Progress
export class GetDealProgressResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  targetQuantity?: number;

  @ApiPropertyOptional()
  securedTons?: number;

  @ApiPropertyOptional()
  remainingTons?: number;

  @ApiPropertyOptional()
  progressPercentage?: number;

  @ApiPropertyOptional()
  activeDealCount?: number;
}
