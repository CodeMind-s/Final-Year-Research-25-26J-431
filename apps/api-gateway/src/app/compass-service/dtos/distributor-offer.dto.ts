import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum OfferRequirement {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum OfferStatus {
  DRAFT = 'DRAFT',
  PUBLISH = 'PUBLISH',
  CLOSED = 'CLOSED',
}

export class CreateDistributorOfferDto {
  @ApiProperty({ example: 150, description: 'Price per kilogram' })
  @IsNumber()
  pricePerKilo: number;

  @ApiProperty({ example: 5000, description: 'Target quantity in kilograms' })
  @IsNumber()
  targetQuantity: number;

  @ApiProperty({ example: 750000, description: 'Total investment amount' })
  @IsNumber()
  totalInvestment: number;

  @ApiProperty({ enum: OfferRequirement, example: OfferRequirement.HIGH, description: 'Requirement level' })
  @IsEnum(OfferRequirement)
  requirement: OfferRequirement;
}

export class UpdateDistributorOfferDto {
  @ApiProperty({ example: 150, description: 'Price per kilogram', required: false })
  @IsOptional()
  @IsNumber()
  pricePerKilo?: number;

  @ApiProperty({ example: 5000, description: 'Target quantity in kilograms', required: false })
  @IsOptional()
  @IsNumber()
  targetQuantity?: number;

  @ApiProperty({ example: 1000, description: 'Collected quantity in kilograms', required: false })
  @IsOptional()
  @IsNumber()
  collectedQuantity?: number;

  @ApiProperty({ example: 750000, description: 'Total investment amount', required: false })
  @IsOptional()
  @IsNumber()
  totalInvestment?: number;

  @ApiProperty({ enum: OfferRequirement, example: OfferRequirement.HIGH, description: 'Requirement level', required: false })
  @IsOptional()
  @IsEnum(OfferRequirement)
  requirement?: OfferRequirement;

  @ApiProperty({ enum: OfferStatus, example: OfferStatus.PUBLISH, description: 'Offer status', required: false })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}

export class CreateDistributorOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    userId: string;
    pricePerKilo: number;
    targetQuantity: number;
    totalInvestment: number;
    status: OfferStatus;
    requirement: OfferRequirement;
    createdAt: Date;
  };
}

export class GetDistributorOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    userId: string;
    pricePerKilo: number;
    targetQuantity: number;
    collectedQuantity: number;
    totalInvestment: number;
    status: OfferStatus;
    requirement: OfferRequirement;
    createdAt: Date;
  };
}

export class UpdateDistributorOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    userId: string;
    pricePerKilo: number;
    targetQuantity: number;
    collectedQuantity: number;
    totalInvestment: number;
    status: OfferStatus;
    requirement: OfferRequirement;
    createdAt: Date;
  };
}

export class GetDistributorOffersResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: Array<{
    id: string;
    userId: string;
    pricePerKilo: number;
    targetQuantity: number;
    collectedQuantity: number;
    totalInvestment: number;
    status: OfferStatus;
    requirement: OfferRequirement;
    createdAt: Date;
  }>;

  @ApiProperty({ required: false })
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export class DeleteDistributorOfferResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
