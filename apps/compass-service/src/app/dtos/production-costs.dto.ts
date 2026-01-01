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
