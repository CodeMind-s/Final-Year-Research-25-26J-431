import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { HarvestPlanService } from './harvest-plan.service';
import type {
  CreatePlanDto,
  CreatePlanResponseDto,
  GetPlanDto,
  GetPlanResponseDto,
  GetPlansDto,
  GetPlansResponseDto,
  UpdatePlanDto,
  UpdatePlanResponseDto,
  DeletePlanDto,
  DeletePlanResponseDto,
  GetDemandPriceDto,
  GetDemandPriceResponseDto,
} from './dtos/harvest-plan.dto';

@Controller('HarvestPlan')
export class HarvestPlanController {
  constructor(private readonly harvestPlanService: HarvestPlanService) {}

  @GrpcMethod('HarvestPlanService', 'CreatePlan')
  async CreatePlan(data: CreatePlanDto): Promise<CreatePlanResponseDto> {
    return this.harvestPlanService.CreatePlan(data);
  }

  @GrpcMethod('HarvestPlanService', 'GetPlan')
  async GetPlan(data: GetPlanDto): Promise<GetPlanResponseDto> {
    return this.harvestPlanService.GetPlan(data);
  }

  @GrpcMethod('HarvestPlanService', 'GetPlans')
  async GetPlans(data: GetPlansDto): Promise<GetPlansResponseDto> {
    return this.harvestPlanService.GetPlans(data);
  }

  @GrpcMethod('HarvestPlanService', 'UpdatePlan')
  async UpdatePlan(data: UpdatePlanDto): Promise<UpdatePlanResponseDto> {
    return this.harvestPlanService.UpdatePlan(data);
  }

  @GrpcMethod('HarvestPlanService', 'DeletePlan')
  async DeletePlan(data: DeletePlanDto): Promise<DeletePlanResponseDto> {
    return this.harvestPlanService.DeletePlan(data);
  }

  @GrpcMethod('HarvestPlanService', 'GetDemandPrice')
  async GetDemandPrice(data: GetDemandPriceDto): Promise<GetDemandPriceResponseDto> {
    return this.harvestPlanService.GetDemandPrice(data);
  }
}
