import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SellerService } from './seller.service';
import {
  GetSellerProfileRequestDto,
  GetSellerProfileResponseDto,
  GetMarketDemandTrendsRequestDto,
  GetMarketDemandTrendsResponseDto,
  CreateOfferRequestDto,
  CreateOfferResponseDto,
  GetCurrentOfferRequestDto,
  GetCurrentOfferResponseDto,
  UpdateOfferRequestDto,
  UpdateOfferResponseDto,
  DeleteOfferRequestDto,
  DeleteOfferResponseDto,
  GetAvailableLandownersRequestDto,
  GetAvailableLandownersResponseDto,
  GetSellerDealsRequestDto,
  GetSellerDealsResponseDto,
  GetDealProgressRequestDto,
  GetDealProgressResponseDto,
} from './dtos/seller.dto';

@Controller('Seller')
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @GrpcMethod('SellerService', 'GetSellerProfile')
  async GetSellerProfile(
    data: GetSellerProfileRequestDto
  ): Promise<GetSellerProfileResponseDto> {
    return this.sellerService.getSellerProfile(data);
  }

  @GrpcMethod('SellerService', 'GetMarketDemandTrends')
  async GetMarketDemandTrends(
    data: GetMarketDemandTrendsRequestDto
  ): Promise<GetMarketDemandTrendsResponseDto> {
    return this.sellerService.getMarketDemandTrends(data);
  }

  @GrpcMethod('SellerService', 'CreateOffer')
  async CreateOffer(
    data: CreateOfferRequestDto
  ): Promise<CreateOfferResponseDto> {
    return this.sellerService.createOffer(data);
  }

  @GrpcMethod('SellerService', 'GetCurrentOffer')
  async GetCurrentOffer(
    data: GetCurrentOfferRequestDto
  ): Promise<GetCurrentOfferResponseDto> {
    return this.sellerService.getCurrentOffer(data);
  }

  @GrpcMethod('SellerService', 'UpdateOffer')
  async UpdateOffer(
    data: UpdateOfferRequestDto
  ): Promise<UpdateOfferResponseDto> {
    return this.sellerService.updateOffer(data);
  }

  @GrpcMethod('SellerService', 'DeleteOffer')
  async DeleteOffer(
    data: DeleteOfferRequestDto
  ): Promise<DeleteOfferResponseDto> {
    return this.sellerService.deleteOffer(data);
  }

  @GrpcMethod('SellerService', 'GetAvailableLandowners')
  async GetAvailableLandowners(
    data: GetAvailableLandownersRequestDto
  ): Promise<GetAvailableLandownersResponseDto> {
    return this.sellerService.getAvailableLandowners(data);
  }

  @GrpcMethod('SellerService', 'GetSellerDeals')
  async GetSellerDeals(
    data: GetSellerDealsRequestDto
  ): Promise<GetSellerDealsResponseDto> {
    return this.sellerService.getSellerDeals(data);
  }

  @GrpcMethod('SellerService', 'GetDealProgress')
  async GetDealProgress(
    data: GetDealProgressRequestDto
  ): Promise<GetDealProgressResponseDto> {
    return this.sellerService.getDealProgress(data);
  }
}
