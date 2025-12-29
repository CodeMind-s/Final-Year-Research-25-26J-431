import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SaltProductionService } from './salt-production.service';
import {
  CreateActualMonthlyProductionDto,
  CreateActualMonthlyProductionResponseDto,
  UpdateActualMonthlyProductionDto,
  UpdateActualMonthlyProductionResponseDto,
  GetActualMonthlyProductionByRangeDto,
  GetActualMonthlyProductionByRangeResponseDto,
  GetActualMonthlyProductionByIdDto,
  GetActualMonthlyProductionByIdResponseDto,
  GetActualMonthlyProductionByMonthDto,
  GetActualMonthlyProductionByMonthResponseDto,
  DeleteActualMonthlyProductionDto,
  DeleteActualMonthlyProductionResponseDto,
} from './dtos/salt-production.dto';

@Controller('SaltProduction')
export class SaltProductionController {
  constructor(
    private readonly saltProductionService: SaltProductionService
  ) {}

  @GrpcMethod('SaltProductionService', 'CreateActualMonthlyProduction')
  async CreateActualMonthlyProduction(
    data: CreateActualMonthlyProductionDto
  ): Promise<CreateActualMonthlyProductionResponseDto> {
    return this.saltProductionService.CreateActualMonthlyProduction(data);
  }

  @GrpcMethod('SaltProductionService', 'GetActualMonthlyProductionByRange')
  async GetActualMonthlyProductionByRange(
    data: GetActualMonthlyProductionByRangeDto
  ): Promise<GetActualMonthlyProductionByRangeResponseDto> {
    return this.saltProductionService.GetActualMonthlyProductionByRange(data);
  }

  @GrpcMethod('SaltProductionService', 'GetActualMonthlyProductionById')
  async GetActualMonthlyProductionById(
    data: GetActualMonthlyProductionByIdDto
  ): Promise<GetActualMonthlyProductionByIdResponseDto> {
    return this.saltProductionService.GetActualMonthlyProductionById(data);
  }

  @GrpcMethod('SaltProductionService', 'GetActualMonthlyProductionByMonth')
  async GetActualMonthlyProductionByMonth(
    data: GetActualMonthlyProductionByMonthDto
  ): Promise<GetActualMonthlyProductionByMonthResponseDto> {
    return this.saltProductionService.GetActualMonthlyProductionByMonth(data);
  }

  @GrpcMethod('SaltProductionService', 'UpdateActualMonthlyProduction')
  async UpdateActualMonthlyProduction(
    data: UpdateActualMonthlyProductionDto
  ): Promise<UpdateActualMonthlyProductionResponseDto> {
    return this.saltProductionService.UpdateActualMonthlyProduction(data);
  }

  @GrpcMethod('SaltProductionService', 'DeleteActualMonthlyProduction')
  async DeleteActualMonthlyProduction(
    data: DeleteActualMonthlyProductionDto
  ): Promise<DeleteActualMonthlyProductionResponseDto> {
    return this.saltProductionService.DeleteActualMonthlyProduction(data);
  }
}
