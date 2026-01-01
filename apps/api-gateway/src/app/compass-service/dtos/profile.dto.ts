import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
