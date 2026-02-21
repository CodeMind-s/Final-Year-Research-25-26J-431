import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum DealStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
  CANCELED = 'CANCELED',
}

export class CreateDealDto {
  @ApiProperty({ example: 1000, description: 'Quantity in kilograms' })
  @IsNumber()
  quantity: number;

  // @ApiProperty({ example: 150, description: 'Price per kilogram' })
  // @IsNumber()
  // pricePerKilo: number;
}

export class UpdateDealDto {
  @ApiProperty({ example: 1000, description: 'Quantity in kilograms', required: false })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ example: 150, description: 'Price per kilogram', required: false })
  @IsOptional()
  @IsNumber()
  pricePerKilo?: number;

  @ApiProperty({ enum: DealStatus, example: DealStatus.ACCEPTED, description: 'Deal status', required: false })
  @IsOptional()
  @IsEnum(DealStatus)
  status?: DealStatus;
}

export class CreateDealResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    landownerId: string;
    offer: any;
    quantity: number;
    pricePerKilo: number;
    createdAt: Date;
    acceptedAt?: Date;
    status: DealStatus;
  };
}

export class GetDealResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    landownerId: string;
    offer: any;
    quantity: number;
    pricePerKilo: number;
    createdAt: Date;
    acceptedAt?: Date;
    status: DealStatus;
  };
}

export class UpdateDealResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: {
    id: string;
    landownerId: string;
    offer: any;
    quantity: number;
    pricePerKilo: number;
    createdAt: Date;
    acceptedAt?: Date;
    status: DealStatus;
  };
}

export class GetDealsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  data?: Array<{
    id: string;
    landownerId: string;
    offer: any;
    quantity: number;
    pricePerKilo: number;
    createdAt: Date;
    acceptedAt?: Date;
    status: DealStatus;
  }>;

  @ApiProperty({ required: false })
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export class DeleteDealResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
