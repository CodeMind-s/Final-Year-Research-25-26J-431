import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DealService } from './deal.service';
import {
  CreateDealDto,
  CreateDealResponseDto,
  UpdateDealDto,
  UpdateDealResponseDto,
  GetDealDto,
  GetDealResponseDto,
  GetDealsDto,
  GetDealsResponseDto,
  DeleteDealDto,
  DeleteDealResponseDto,
} from './dtos/deal.dto';

@Controller()
export class DealController {
  constructor(private readonly dealService: DealService) {}

  @GrpcMethod('DealService', 'CreateDeal')
  async createDeal(data: CreateDealDto): Promise<CreateDealResponseDto> {
    return this.dealService.createDeal(data);
  }

  @GrpcMethod('DealService', 'UpdateDeal')
  async updateDeal(data: UpdateDealDto): Promise<UpdateDealResponseDto> {
    return this.dealService.updateDeal(data);
  }

  @GrpcMethod('DealService', 'GetDeal')
  async getDeal(data: GetDealDto): Promise<GetDealResponseDto> {
    return this.dealService.getDeal(data);
  }

  @GrpcMethod('DealService', 'GetDeals')
  async getDeals(data: GetDealsDto): Promise<GetDealsResponseDto> {
    return this.dealService.getDeals(data);
  }

  @GrpcMethod('DealService', 'DeleteDeal')
  async deleteDeal(data: DeleteDealDto): Promise<DeleteDealResponseDto> {
    return this.dealService.deleteDeal(data);
  }
}
