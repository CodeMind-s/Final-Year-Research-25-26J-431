import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CrystallizationService } from './crystallization.service';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto } from './dtos/crystallization.dto';

@Controller('Crystallization')
export class CrystallizationController {
  constructor(
    private readonly CrystallizationService: CrystallizationService
  ) {}

  @GrpcMethod('CrystallizationService', 'CreateDailyMeasurement')
  async CreateDailyMeasurement(data: CreateDailyMeasurementDto): Promise<CreateDailyMeasurementResponseDto> {
    return this.CrystallizationService.CreateDailyMeasurement(data);
  }
}
