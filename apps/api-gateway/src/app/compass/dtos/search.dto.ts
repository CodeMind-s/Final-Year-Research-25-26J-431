import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

// Search Sellers
export class SearchSellersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reliability?: string;
}

export class SearchSellersResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  sellers?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    reliability: string;
    currentPricePerTon: number;
    demandTons: number;
  }>;
}

// Search Landowners
export class SearchLandownersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minTons?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  priority?: boolean;
}

export class SearchLandownersResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  landowners?: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    totalProductionTons: number;
    availableTons: number;
    priority: boolean;
  }>;
}
