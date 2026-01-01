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
