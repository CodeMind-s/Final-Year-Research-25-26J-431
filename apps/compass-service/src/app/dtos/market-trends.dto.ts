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
