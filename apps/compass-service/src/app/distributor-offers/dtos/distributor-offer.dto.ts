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

export interface CreateDistributorOfferDto {
  userId: string;
  pricePerKilo: number;
  targetQuantity: number;
  totalInvestment: number;
  requirement: OfferRequirement;
}

export interface CreateDistributorOfferResponseDto {
  success: boolean;
  message: string;
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

export interface UpdateDistributorOfferDto {
  id: string;
  pricePerKilo?: number;
  targetQuantity?: number;
  collectedQuantity?: number;
  totalInvestment?: number;
  requirement?: OfferRequirement;
  status?: OfferStatus;
}

export interface UpdateDistributorOfferResponseDto {
  success: boolean;
  message: string;
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

export interface GetDistributorOfferDto {
  id: string;
}

export interface GetDistributorOfferResponseDto {
  success: boolean;
  message: string;
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

export interface GetDistributorOffersDto {
  userId?: string;
  status?: OfferStatus;
  requirement?: OfferRequirement;
  page?: number;
  limit?: number;
}

export interface GetDistributorOffersResponseDto {
  success: boolean;
  message: string;
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
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface DeleteDistributorOfferDto {
  id: string;
}

export interface DeleteDistributorOfferResponseDto {
  success: boolean;
  message: string;
}
