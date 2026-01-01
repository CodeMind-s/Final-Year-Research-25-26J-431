import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean } from 'class-validator';

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

// Get Seller Offers (for landowners)
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
