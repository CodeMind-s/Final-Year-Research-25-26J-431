export class SearchSellersRequestDto {
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  reliability?: string; // "High|Medium|Low"
}

export class SellerSearchResultDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  reliability: string;
  currentPricePerTon: number;
  demandTons: number;
}

export class SearchSellersResponseDto {
  success: boolean;
  message: string;
  sellers: SellerSearchResultDto[];
}

export class SearchLandownersRequestDto {
  name?: string;
  minTons?: number;
  priority?: boolean;
}

export class LandownerSearchResultDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalProductionTons: number;
  availableTons: number;
  priority: boolean;
}

export class SearchLandownersResponseDto {
  success: boolean;
  message: string;
  landowners: LandownerSearchResultDto[];
}
