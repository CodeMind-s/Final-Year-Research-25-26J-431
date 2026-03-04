import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { WasteManagementService } from './waste-management.service';
import type {
  GetWastePredictionsGrpcDto,
  GetWastePredictionsGrpcResponseDto,
  QuickPredictionGrpcDto,
  QuickPredictionGrpcResponseDto,
} from './dtos/waste-management.dto';

@Controller()
export class WasteManagementController {
  constructor(
    private readonly wasteManagementService: WasteManagementService
  ) {}

  @GrpcMethod('WasteValorizationManagementService', 'GetWastePredictions')
  async getWastePredictions(
    data: GetWastePredictionsGrpcDto
  ): Promise<GetWastePredictionsGrpcResponseDto> {
    return this.wasteManagementService.getWastePredictions(data);
  }

  @GrpcMethod('WasteValorizationManagementService', 'QuickPrediction')
  async quickPrediction(
    data: QuickPredictionGrpcDto
  ): Promise<QuickPredictionGrpcResponseDto> {
    return this.wasteManagementService.quickPrediction(data);
  }
}
