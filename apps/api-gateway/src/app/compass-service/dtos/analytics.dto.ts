import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Get Landowner Analytics
export class GetLandownerAnalyticsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  totalRevenue?: number;

  @ApiPropertyOptional()
  totalProfit?: number;

  @ApiPropertyOptional()
  totalTonsSold?: number;

  @ApiPropertyOptional()
  averagePricePerTon?: number;

  @ApiPropertyOptional()
  dealCount?: number;

  @ApiPropertyOptional()
  topBuyers?: Array<{
    sellerId: string;
    sellerName: string;
    totalTonsPurchased: number;
  }>;
}

// Get Seller Analytics
export class GetSellerAnalyticsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  totalInvestment?: number;

  @ApiPropertyOptional()
  totalTonsPurchased?: number;

  @ApiPropertyOptional()
  averagePricePerTon?: number;

  @ApiPropertyOptional()
  dealCount?: number;

  @ApiPropertyOptional()
  topSuppliers?: Array<{
    landownerId: string;
    landownerName: string;
    totalTonsSold: number;
  }>;
}
