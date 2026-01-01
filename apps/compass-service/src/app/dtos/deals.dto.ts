// ============================================
// Deal Creation DTOs
// ============================================

export class DealAllocationDto {
  sellerId: string;
  sellerName: string;
  quantity: number;
  pricePerTon: number;
  revenue: number;
}

export class CreateDealRequestDto {
  sellerId: string;
  sellerName: string;
  landownerId: string;
  landownerName: string;
  allocations: DealAllocationDto[];
  totalQuantity: number;
  totalRevenue: number;
  productionCosts: number;
  netProfit: number;
  status: string; // "accepted|negotiating"
}

export class CreateDealResponseDto {
  success: boolean;
  message: string;
  dealId?: string;
}

// ============================================
// Get Deals DTOs (for landowners)
// ============================================

export class GetDealsRequestDto {
  landownerId: string;
  status: string; // "accepted|completed|negotiating|all"
}

export class NegotiationDto {
  id: string;
  message: string;
  timestamp: number;
}

export class DealDto {
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
  acceptedAt?: number;
  completedAt?: number;
  negotiations: NegotiationDto[];
}

export class GetDealsResponseDto {
  success: boolean;
  message: string;
  deals: DealDto[];
}

// ============================================
// Update Deal Status DTOs
// ============================================

export class UpdateDealStatusRequestDto {
  dealId: string;
  status: string; // "completed|rejected"
}

export class UpdateDealStatusResponseDto {
  success: boolean;
  message: string;
  updatedDeal?: DealDto;
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
