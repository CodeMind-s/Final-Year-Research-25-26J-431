import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DistributorOfferService } from './distributor-offer.service';
import {
  CreateDistributorOfferDto,
  CreateDistributorOfferResponseDto,
  UpdateDistributorOfferDto,
  UpdateDistributorOfferResponseDto,
  GetDistributorOfferDto,
  GetDistributorOfferResponseDto,
  GetDistributorOffersDto,
  GetDistributorOffersResponseDto,
  DeleteDistributorOfferDto,
  DeleteDistributorOfferResponseDto,
} from './dtos/distributor-offer.dto';

@Controller()
export class DistributorOfferController {
  constructor(private readonly distributorOfferService: DistributorOfferService) {}

  @GrpcMethod('DistributorOfferService', 'CreateOffer')
  async createOffer(data: CreateDistributorOfferDto): Promise<CreateDistributorOfferResponseDto> {
    return this.distributorOfferService.createOffer(data);
  }

  @GrpcMethod('DistributorOfferService', 'UpdateOffer')
  async updateOffer(data: UpdateDistributorOfferDto): Promise<UpdateDistributorOfferResponseDto> {
    return this.distributorOfferService.updateOffer(data);
  }

  @GrpcMethod('DistributorOfferService', 'GetOffer')
  async getOffer(data: GetDistributorOfferDto): Promise<GetDistributorOfferResponseDto> {
    return this.distributorOfferService.getOffer(data);
  }

  @GrpcMethod('DistributorOfferService', 'GetOffers')
  async getOffers(data: GetDistributorOffersDto): Promise<GetDistributorOffersResponseDto> {
    return this.distributorOfferService.getOffers(data);
  }

  @GrpcMethod('DistributorOfferService', 'DeleteOffer')
  async deleteOffer(data: DeleteDistributorOfferDto): Promise<DeleteDistributorOfferResponseDto> {
    return this.distributorOfferService.deleteOffer(data);
  }
}
