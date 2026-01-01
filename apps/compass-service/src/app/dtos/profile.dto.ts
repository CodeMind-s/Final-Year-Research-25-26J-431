// ============================================
// Landowner Profile DTOs
// ============================================

export class GetLandownerProfileRequestDto {
  landownerId: string;
}

export class LandownerProfileDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalProductionTons: number;
  availableTons: number;
  soldTons: number;
}

export class GetLandownerProfileResponseDto {
  success: boolean;
  message: string;
  data?: LandownerProfileDto;
}

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
