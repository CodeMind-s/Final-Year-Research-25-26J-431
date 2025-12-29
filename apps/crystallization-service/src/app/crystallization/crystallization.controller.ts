import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CrystallizationService } from './crystallization.service';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementByDateDto, GetDailyMeasurementByDateResponseDto, GetDailyMeasurementsByDateRangeDto, GetDailyMeasurementsByDateRangeResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdDto, DeleteDailyMeasurementByIdResponseDto, GetPredictionsDto, GetPredictionsResponseDto, GetPredictedDailyMeasurementDto, GetPredictedDailyMeasurementResponseDto, GetPredictedMonthlyProductionDto, GetPredictedMonthlyProductionResponseDto } from './dtos/crystallization.dto';

@Controller('Crystallization')
export class CrystallizationController {
  constructor(
    private readonly CrystallizationService: CrystallizationService
  ) { }

  @GrpcMethod('CrystallizationService', 'CreateDailyMeasurement')
  async CreateDailyMeasurement(data: CreateDailyMeasurementDto): Promise<CreateDailyMeasurementResponseDto> {
    return this.CrystallizationService.CreateDailyMeasurement(data);
  }

  @GrpcMethod('CrystallizationService', 'GetDailyMeasurementByDate')
  async GetDailyMeasurementByDate(data: GetDailyMeasurementByDateDto): Promise<GetDailyMeasurementByDateResponseDto> {
    return this.CrystallizationService.GetDailyMeasurementByDate(data);
  }

  @GrpcMethod('CrystallizationService', 'GetDailyMeasurementsByDateRange')
  async GetDailyMeasurementsByDateRange(data: GetDailyMeasurementsByDateRangeDto): Promise<GetDailyMeasurementsByDateRangeResponseDto> {
    return this.CrystallizationService.GetDailyMeasurementsByDateRange(data);
  }

  @GrpcMethod('CrystallizationService', 'UpdateDailyMeasurementById')
  async UpdateDailyMeasurementById(data: UpdateDailyMeasurementByIdDto): Promise<UpdateDailyMeasurementByIdResponseDto> {
    return this.CrystallizationService.UpdateDailyMeasurementById(data);
  }

  @GrpcMethod('CrystallizationService', 'DeleteDailyMeasurementById')
  async DeleteDailyMeasurementById(data: DeleteDailyMeasurementByIdDto): Promise<DeleteDailyMeasurementByIdResponseDto> {
    return this.CrystallizationService.DeleteDailyMeasurementById(data);
  }

  @GrpcMethod('CrystallizationService', 'GetPredictions')
  async GetPredictions(data: GetPredictionsDto): Promise<GetPredictionsResponseDto> {
    return this.CrystallizationService.GetPredictions(data);
  }

  @GrpcMethod('CrystallizationService', 'GetPredictedDailyMeasurement')
  async GetPredictedDailyMeasurement(data: GetPredictedDailyMeasurementDto): Promise<GetPredictedDailyMeasurementResponseDto> {
    return this.CrystallizationService.GetPredictedDailyMeasurement(data);
  }

  @GrpcMethod('CrystallizationService', 'GetPredictedMonthlyProduction')
  async GetPredictedMonthlyProduction(data: GetPredictedMonthlyProductionDto): Promise<GetPredictedMonthlyProductionResponseDto> {
    return this.CrystallizationService.GetPredictedMonthlyProduction(data);
  }
}

