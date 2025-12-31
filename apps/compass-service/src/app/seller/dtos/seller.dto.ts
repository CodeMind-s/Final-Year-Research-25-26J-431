// ============================================
// Seller Profile DTOs
// ============================================

export class GetSellerProfileRequestDto {
  sellerId: string;
}

export class SellerProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  reliability: string;
  totalPurchased: number;
  activeCampaigns: number;
}

export class GetSellerProfileResponseDto {
  success: boolean;
  message: string;
  data?: SellerProfileDto;
}

// ============================================
// Market Demand Trends DTOs
// ============================================

export class GetMarketDemandTrendsRequestDto {
  months: number;
  region: string;
}

export class DemandTrendDto {
  month: string;
  demand: number;
}

export class GetMarketDemandTrendsResponseDto {
  success: boolean;
  message: string;
  trends: DemandTrendDto[];
  currentDemand: number;
  trend: string;
}

// ============================================
// Offer Management DTOs
// ============================================

export class CreateOfferRequestDto {
  sellerId: string;
  sellerName: string;
  pricePerTon: number;
  demandTons: number;
  reliability: string;
  isRecommended: boolean;
}

export class CreateOfferResponseDto {
  success: boolean;
  message: string;
  offerId?: string;
}

export class GetCurrentOfferRequestDto {
  sellerId: string;
}

export class OfferDto {
  id: string;
  sellerId: string;
  pricePerTon: number;
  demandTons: number;
  reliability: string;
  timestamp: number;
}

export class GetCurrentOfferResponseDto {
  success: boolean;
  message: string;
  offer?: OfferDto;
}

export class UpdateOfferRequestDto {
  sellerId: string;
  offerId: string;
  pricePerTon: number;
  demandTons: number;
}

export class UpdateOfferResponseDto {
  success: boolean;
  message: string;
  updatedOffer?: OfferDto;
}

export class DeleteOfferRequestDto {
  sellerId: string;
  offerId: string;
}

export class DeleteOfferResponseDto {
  success: boolean;
  message: string;
}

// ============================================
// Available Landowners DTOs
// ============================================

export class GetAvailableLandownersRequestDto {
  sellerId: string;
}

export class AvailableLandownerDto {
  id: string;
  name: string;
  productionTons: number;
  availableTons: number;
  harvestDate: string;
  priority: boolean;
}

export class GetAvailableLandownersResponseDto {
  success: boolean;
  message: string;
  landowners: AvailableLandownerDto[];
}

// ============================================
// Seller Deals DTOs
// ============================================

export class GetSellerDealsRequestDto {
  sellerId: string;
  status: string;
}

export class SellerDealDto {
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
  acceptedAt?: number;
  completedAt?: number;
}

export class GetSellerDealsResponseDto {
  success: boolean;
  message: string;
  deals: SellerDealDto[];
  securedTons: number;
  remainingTons: number;
}

// ============================================
// Deal Progress DTOs
// ============================================

export class GetDealProgressRequestDto {
  sellerId: string;
}

export class GetDealProgressResponseDto {
  success: boolean;
  message: string;
  targetQuantity: number;
  securedTons: number;
  remainingTons: number;
  progressPercentage: number;
  activeDealCount: number;
}
