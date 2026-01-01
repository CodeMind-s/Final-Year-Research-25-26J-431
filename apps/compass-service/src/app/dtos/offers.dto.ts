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
// Seller Offers DTOs (for landowners viewing)
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
