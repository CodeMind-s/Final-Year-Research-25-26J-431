import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { WasteManagementService } from './waste-management.service';
import { PriceEstimateService } from './price-estimate.service';
import type {
  GetWastePredictionsGrpcDto,
  GetWastePredictionsGrpcResponseDto,
  GetWasteMonthlyPredictionsGrpcDto,
  GetWasteMonthlyPredictionsGrpcResponseDto,
  QuickPredictionGrpcDto,
  QuickPredictionGrpcResponseDto,
  GetPriceEstimatesRequest,
  GetPriceEstimatesResponse,
  UpsertPriceEstimatesRequest,
  UpsertPriceEstimatesResponse,
} from './dtos/waste-management.dto';

@Controller()
export class WasteManagementController {
  constructor(
    private readonly wasteManagementService: WasteManagementService,
    private readonly priceEstimateService: PriceEstimateService,
  ) {}
  @GrpcMethod('WasteValorizationManagementService', 'GetWastePredictions')
  async getWastePredictions(
    data: GetWastePredictionsGrpcDto
  ): Promise<GetWastePredictionsGrpcResponseDto> {
    return this.wasteManagementService.getWastePredictions(data);
  }

  @GrpcMethod('WasteValorizationManagementService', 'GetPriceEstimates')
  async getPriceEstimates(
    data: GetPriceEstimatesRequest
  ): Promise<GetPriceEstimatesResponse> {
    const prices = await this.priceEstimateService.getForSite(data.siteId || undefined);
    return {
      success: true,
      data: JSON.stringify(prices),
      timestamp: new Date().toISOString(),
    };
  }

  @GrpcMethod('WasteValorizationManagementService', 'UpsertPriceEstimates')
  async upsertPriceEstimates(
    data: UpsertPriceEstimatesRequest
  ): Promise<UpsertPriceEstimatesResponse> {
    const payload: any = {};
    if (data.epsom_salt) payload.epsom_salt = data.epsom_salt;
    if (data.potash) payload.potash = data.potash;
    if (data.magnesium_oil) payload.magnesium_oil = data.magnesium_oil;
    if (data.gypsum) payload.gypsum = data.gypsum;
    if (data.limestone) payload.limestone = data.limestone;
    if (data.industrial_salt) payload.industrial_salt = data.industrial_salt;
    if ((data as any).currency) payload.currency = (data as any).currency;

    const saved = await this.priceEstimateService.upsertForSite(data.siteId || null, data.userId || null, payload);
    return {
      success: true,
      data: JSON.stringify(saved),
      timestamp: new Date().toISOString(),
    };
  }
  @GrpcMethod('WasteValorizationManagementService', 'QuickPrediction')
  async quickPrediction(
    data: QuickPredictionGrpcDto
  ): Promise<QuickPredictionGrpcResponseDto> {
    return this.wasteManagementService.quickPrediction(data);
  }

  @GrpcMethod('WasteValorizationManagementService', 'GetWasteMonthlyPredictions')
  async getWasteMonthlyPredictions(
    data: GetWasteMonthlyPredictionsGrpcDto
  ): Promise<GetWasteMonthlyPredictionsGrpcResponseDto> {
    return this.wasteManagementService.getWasteMonthlyPredictions(data);
  }

  @GrpcMethod('WasteValorizationManagementService', 'GetPredictionReportDetailed')
  async getPredictionReportDetailed(data: any) {
    const resp = await this.wasteManagementService.getPredictionReportDetailed({ siteId: data.siteId, startMonth: data.startMonth, endMonth: data.endMonth, currency: data.currency, format: data.format });
    return { success: true, data: JSON.stringify(resp.data), timestamp: new Date().toISOString() };
  }

  @GrpcMethod('WasteValorizationManagementService', 'GetPredictionReportSummary')
  async getPredictionReportSummary(data: any) {
    const resp = await this.wasteManagementService.getPredictionReportSummary({ siteId: data.siteId, startMonth: data.startMonth, endMonth: data.endMonth, currency: data.currency });
    return { success: true, data: JSON.stringify(resp.data), timestamp: new Date().toISOString() };
  }
}
