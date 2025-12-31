export class GetLandownerAnalyticsRequestDto {
  landownerId: string;
  period: string; // "week|month|year"
}

export class TopBuyerDto {
  sellerId: string;
  sellerName: string;
  totalTonsPurchased: number;
}

export class GetLandownerAnalyticsResponseDto {
  success: boolean;
  message: string;
  totalRevenue: number;
  totalProfit: number;
  totalTonsSold: number;
  averagePricePerTon: number;
  dealCount: number;
  topBuyers: TopBuyerDto[];
}

export class GetSellerAnalyticsRequestDto {
  sellerId: string;
  period: string; // "week|month|year"
}

export class TopSupplierDto {
  landownerId: string;
  landownerName: string;
  totalTonsSold: number;
}

export class GetSellerAnalyticsResponseDto {
  success: boolean;
  message: string;
  totalInvestment: number;
  totalTonsPurchased: number;
  averagePricePerTon: number;
  dealCount: number;
  topSuppliers: TopSupplierDto[];
}
