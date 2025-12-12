import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CrystallizationService } from './crystallization.service';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementByDateDto, GetDailyMeasurementByDateResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdDto, DeleteDailyMeasurementByIdResponseDto } from './dtos/crystallization.dto';

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

  @GrpcMethod('CrystallizationService', 'UpdateDailyMeasurementById')
  async UpdateDailyMeasurementById(data: UpdateDailyMeasurementByIdDto): Promise<UpdateDailyMeasurementByIdResponseDto> {
    return this.CrystallizationService.UpdateDailyMeasurementById(data);
  }

  @GrpcMethod('CrystallizationService', 'DeleteDailyMeasurementById')
  async DeleteDailyMeasurementById(data: DeleteDailyMeasurementByIdDto): Promise<DeleteDailyMeasurementByIdResponseDto> {
    return this.CrystallizationService.DeleteDailyMeasurementById(data);
  }
}

