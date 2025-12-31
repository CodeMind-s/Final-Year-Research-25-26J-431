import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LandownerService } from './landowner.service';
import {
  GetLandownerProfileRequestDto,
  GetLandownerProfileResponseDto,
  UpdateProductionCostsRequestDto,
  UpdateProductionCostsResponseDto,
  GetHarvestPredictionRequestDto,
  GetHarvestPredictionResponseDto,
  GetPricePredictionRequestDto,
  GetPricePredictionResponseDto,
  GetDemandPredictionRequestDto,
  GetDemandPredictionResponseDto,
  GetSellerRecommendationsRequestDto,
  GetSellerRecommendationsResponseDto,
  GetSellerOffersRequestDto,
  GetSellerOffersResponseDto,
  CreateDealRequestDto,
  CreateDealResponseDto,
  GetDealsRequestDto,
  GetDealsResponseDto,
  UpdateDealStatusRequestDto,
  UpdateDealStatusResponseDto,
} from './dtos/landowner.dto';

@Controller('Landowner')
export class LandownerController {
  constructor(private readonly landownerService: LandownerService) {}

  @GrpcMethod('LandownerService', 'GetLandownerProfile')
  async GetLandownerProfile(
    data: GetLandownerProfileRequestDto
  ): Promise<GetLandownerProfileResponseDto> {
    return this.landownerService.getLandownerProfile(data);
  }

  @GrpcMethod('LandownerService', 'UpdateProductionCosts')
  async UpdateProductionCosts(
    data: UpdateProductionCostsRequestDto
  ): Promise<UpdateProductionCostsResponseDto> {
    return this.landownerService.updateProductionCosts(data);
  }

  @GrpcMethod('LandownerService', 'GetHarvestPrediction')
  async GetHarvestPrediction(
    data: GetHarvestPredictionRequestDto
  ): Promise<GetHarvestPredictionResponseDto> {
    return this.landownerService.getHarvestPrediction(data);
  }

  @GrpcMethod('LandownerService', 'GetPricePrediction')
  async GetPricePrediction(
    data: GetPricePredictionRequestDto
  ): Promise<GetPricePredictionResponseDto> {
    return this.landownerService.getPricePrediction(data);
  }

  @GrpcMethod('LandownerService', 'GetDemandPrediction')
  async GetDemandPrediction(
    data: GetDemandPredictionRequestDto
  ): Promise<GetDemandPredictionResponseDto> {
    return this.landownerService.getDemandPrediction(data);
  }

  @GrpcMethod('LandownerService', 'GetSellerRecommendations')
  async GetSellerRecommendations(
    data: GetSellerRecommendationsRequestDto
  ): Promise<GetSellerRecommendationsResponseDto> {
    return this.landownerService.getSellerRecommendations(data);
  }

  @GrpcMethod('LandownerService', 'GetSellerOffers')
  async GetSellerOffers(
    data: GetSellerOffersRequestDto
  ): Promise<GetSellerOffersResponseDto> {
    return this.landownerService.getSellerOffers(data);
  }

  @GrpcMethod('LandownerService', 'CreateDeal')
  async CreateDeal(
    data: CreateDealRequestDto
  ): Promise<CreateDealResponseDto> {
    return this.landownerService.createDeal(data);
  }

  @GrpcMethod('LandownerService', 'GetDeals')
  async GetDeals(data: GetDealsRequestDto): Promise<GetDealsResponseDto> {
    return this.landownerService.getDeals(data);
  }

  @GrpcMethod('LandownerService', 'UpdateDealStatus')
  async UpdateDealStatus(
    data: UpdateDealStatusRequestDto
  ): Promise<UpdateDealStatusResponseDto> {
    return this.landownerService.updateDealStatus(data);
  }
}
