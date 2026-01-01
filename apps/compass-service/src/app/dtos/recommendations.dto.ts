// ============================================
// Seller Recommendations DTOs
// ============================================

export class GetSellerRecommendationsRequestDto {
  landownerId: string;
  availableTons: number;
  region: string;
}

export class SellerRecommendationDto {
  seller_id: number;
  sellerName: string;
  confidence: number;
  confidence_percentage: string;
  ranking: number; // 1, 2, or 3
}

export class GetSellerRecommendationsResponseDto {
  success: boolean;
  message: string;
  recommendations: SellerRecommendationDto[];
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
