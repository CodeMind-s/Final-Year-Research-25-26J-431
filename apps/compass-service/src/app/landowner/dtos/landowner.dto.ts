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
// Production Costs DTOs
// ============================================

export class UpdateProductionCostsRequestDto {
  landownerId: string;
  fertilizerCost: number;
  laborCost: number;
  transportCost: number;
}

export class ProductionCostsDto {
  fertilizerCost: number;
  laborCost: number;
  transportCost: number;
}

export class UpdateProductionCostsResponseDto {
  success: boolean;
  message: string;
  costs?: ProductionCostsDto;
}

// ============================================
// Harvest Prediction DTOs
// ============================================

export class MonthDataDto {
  month: string;
  tons: number;
}

export class GetHarvestPredictionRequestDto {
  landownerId: string;
  past6Months: MonthDataDto[];
}

export class PredictionDataDto {
  month: string;
  tons: number;
  isPrediction: boolean;
  confidence?: number;
}

export class GetHarvestPredictionResponseDto {
  success: boolean;
  message: string;
  predictions: PredictionDataDto[];
  historicalData: PredictionDataDto[];
}

// ============================================
// Price Prediction DTOs
// ============================================

export class PriceDataInputDto {
  month: string;
  avgPrice: number;
}

export class GetPricePredictionRequestDto {
  region: string;
  historicalPrices: PriceDataInputDto[];
}

export class PricePredictionDataDto {
  month: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  isPrediction: boolean;
}

export class GetPricePredictionResponseDto {
  success: boolean;
  message: string;
  predictions: PricePredictionDataDto[];
  historicalData: PricePredictionDataDto[];
}

// ============================================
// Demand Prediction DTOs
// ============================================

export class GetDemandPredictionRequestDto {
  region: string;
  productType: string;
}

export class DemandPredictionDataDto {
  month: string;
  demandTons: number;
  isPrediction: boolean;
  trend?: string; // "increasing|stable|decreasing"
}

export class GetDemandPredictionResponseDto {
  success: boolean;
  message: string;
  predictions: DemandPredictionDataDto[];
  historicalData: DemandPredictionDataDto[];
}

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
// Seller Offers DTOs
// ============================================

export class GetSellerOffersRequestDto {
  landownerId: string;
}

export class SellerOfferDto {
  id: string;
  sellerId: string;
  sellerName: string;
  pricePerTon: number;
  demandTons: number;
  reliability: string; // "High|Medium|Low"
  isRecommended: boolean;
  timestamp: number;
}

export class GetSellerOffersResponseDto {
  success: boolean;
  message: string;
  offers: SellerOfferDto[];
}

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
// Get Deals DTOs
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
