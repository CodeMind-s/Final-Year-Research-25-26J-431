import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Common DTOs
export class MonthDataDto {
  @ApiProperty({ example: '2025-01' })
  @IsString()
  month: string;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  tons: number;
}

export class PriceDataDto {
  @ApiProperty({ example: '2025-01' })
  @IsString()
  month: string;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  avgPrice: number;
}

export class DealAllocationDto {
  @ApiProperty()
  @IsString()
  sellerId: string;

  @ApiProperty()
  @IsString()
  sellerName: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  pricePerTon: number;

  @ApiProperty()
  @IsNumber()
  revenue: number;
}

// Get Landowner Profile
export class GetLandownerProfileResponseDto {
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
    totalProductionTons: number;
    availableTons: number;
    soldTons: number;
  };
}

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

// Get Price Prediction
export class GetPricePredictionDto {
  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;

  @ApiProperty({ type: [PriceDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceDataDto)
  historicalPrices: PriceDataDto[];
}

export class GetPricePredictionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  predictions?: Array<{
    month: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    isPrediction: boolean;
  }>;

  @ApiPropertyOptional()
  historicalData?: Array<{
    month: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    isPrediction: boolean;
  }>;
}

// Get Demand Prediction
export class GetDemandPredictionDto {
  @ApiProperty({ example: 'North' })
  @IsString()
  region: string;

  @ApiProperty({ example: 'Sea Salt' })
  @IsString()
  productType: string;
}

export class GetDemandPredictionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  predictions?: Array<{
    month: string;
    demandTons: number;
    isPrediction: boolean;
    trend: string;
  }>;

  @ApiPropertyOptional()
  historicalData?: Array<{
    month: string;
    demandTons: number;
    isPrediction: boolean;
    trend: string;
  }>;
}

// Get Seller Recommendations
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

// Get Seller Offers
export class GetSellerOffersResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  offers?: Array<{
    id: string;
    sellerId: string;
    sellerName: string;
    pricePerTon: number;
    demandTons: number;
    reliability: string;
    isRecommended: boolean;
    timestamp: number;
  }>;
}

// Create Deal
export class CreateDealDto {
  @ApiProperty()
  @IsString()
  sellerId: string;

  @ApiProperty()
  @IsString()
  sellerName: string;

  @ApiProperty()
  @IsString()
  landownerId: string;

  @ApiProperty()
  @IsString()
  landownerName: string;

  @ApiProperty({ type: [DealAllocationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DealAllocationDto)
  allocations: DealAllocationDto[];

  @ApiProperty()
  @IsNumber()
  totalQuantity: number;

  @ApiProperty()
  @IsNumber()
  totalRevenue: number;

  @ApiProperty()
  @IsNumber()
  productionCosts: number;

  @ApiProperty()
  @IsNumber()
  netProfit: number;

  @ApiProperty({ example: 'accepted' })
  @IsString()
  status: string;
}

export class CreateDealResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  dealId?: string;
}

// Get Deals
export class GetDealsResponseDto {
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
    productionCosts: number;
    netProfit: number;
    status: string;
    createdAt: number;
    acceptedAt: number;
    completedAt: number;
    negotiations: Array<{
      id: string;
      message: string;
      timestamp: number;
    }>;
  }>;
}

// Update Deal Status
export class UpdateDealStatusDto {
  @ApiProperty({ example: 'completed' })
  @IsString()
  status: string;
}

export class UpdateDealStatusResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  updatedDeal?: any;
}
