import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Common DTOs
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

// Get Deals (for landowners)
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

// Get Seller Deals (for sellers)
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

// Get Deal Progress (for sellers)
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
