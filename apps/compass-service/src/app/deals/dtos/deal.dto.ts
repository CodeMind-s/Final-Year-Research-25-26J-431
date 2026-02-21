export enum DealStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
  CANCELED = 'CANCELED',
}

export interface CreateDealDto {
  landownerId: string;
  offerId: string;
  quantity: number;
  // pricePerKilo: number;
}

export interface CreateDealResponseDto {
  success: boolean;
  message: string;
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

export interface UpdateDealDto {
  id: string;
  quantity?: number;
  pricePerKilo?: number;
  status?: DealStatus;
}

export interface UpdateDealResponseDto {
  success: boolean;
  message: string;
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

export interface GetDealDto {
  id: string;
}

export interface GetDealResponseDto {
  success: boolean;
  message: string;
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

export interface GetDealsDto {
  landownerId?: string;
  distributorId?: string;
  status?: DealStatus;
  page?: number;
  limit?: number;
}

export interface GetDealsResponseDto {
  success: boolean;
  message: string;
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
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface DeleteDealDto {
  id: string;
}

export interface DeleteDealResponseDto {
  success: boolean;
  message: string;
}
