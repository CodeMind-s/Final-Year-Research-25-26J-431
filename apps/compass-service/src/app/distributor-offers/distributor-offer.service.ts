import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DistributorOffer, OfferStatus } from './schemas/distributor-offer.schema';
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

@Injectable()
export class DistributorOfferService {
  constructor(
    @InjectModel(DistributorOffer.name)
    private distributorOfferModel: Model<DistributorOffer>
  ) {}

  async createOffer(data: CreateDistributorOfferDto): Promise<CreateDistributorOfferResponseDto> {
    try {
      const offer = new this.distributorOfferModel({
        userId: data.userId,
        pricePerKilo: data.pricePerKilo,
        targetQuantity: data.targetQuantity,
        totalInvestment: data.totalInvestment,
        requirement: data.requirement,
        status: OfferStatus.DRAFT,
        collectedQuantity: 0,
      });

      const savedOffer = await offer.save();

      return {
        success: true,
        message: 'Distributor offer created successfully',
        data: this.formatOfferResponse(savedOffer),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create distributor offer: ${error.message}`,
      };
    }
  }

  async updateOffer(data: UpdateDistributorOfferDto): Promise<UpdateDistributorOfferResponseDto> {
    try {
      const offer = await this.distributorOfferModel.findById(data.id).exec();

      if (!offer) {
        return {
          success: false,
          message: 'Distributor offer not found',
        };
      }

      // Update only provided fields
      if (data.pricePerKilo !== undefined) offer.pricePerKilo = data.pricePerKilo;
      if (data.targetQuantity !== undefined) offer.targetQuantity = data.targetQuantity;
      if (data.collectedQuantity !== undefined) offer.collectedQuantity = data.collectedQuantity;
      if (data.totalInvestment !== undefined) offer.totalInvestment = data.totalInvestment;
      if (data.requirement !== undefined) offer.requirement = data.requirement;
      if (data.status !== undefined) offer.status = data.status;

      const updatedOffer = await offer.save();

      return {
        success: true,
        message: 'Distributor offer updated successfully',
        data: this.formatOfferResponseWithCollected(updatedOffer),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update distributor offer: ${error.message}`,
      };
    }
  }

  async getOffer(data: GetDistributorOfferDto): Promise<GetDistributorOfferResponseDto> {
    try {
      const offer = await this.distributorOfferModel.findById(data.id).exec();

      if (!offer) {
        return {
          success: false,
          message: 'Distributor offer not found',
        };
      }

      return {
        success: true,
        message: 'Distributor offer retrieved successfully',
        data: this.formatOfferResponseWithCollected(offer),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve distributor offer: ${error.message}`,
      };
    }
  }

  async getOffers(data: GetDistributorOffersDto): Promise<GetDistributorOffersResponseDto> {
    try {
      const filter: any = {};

      // Build filter object - only add non-null/undefined values
      if (data.userId && data.userId.trim()) {
        filter.userId = data.userId;
      }
      if (data.status && data.status.trim()) {
        filter.status = data.status;
      }
      if (data.requirement && data.requirement.trim()) {
        filter.requirement = data.requirement;
      }

      // Pagination
      const page = data.page && data.page >= 1 ? data.page : 1;
      const limit = data.limit && data.limit > 0 ? data.limit : 10;
      const skip = (page - 1) * limit;

      const [offers, totalItems] = await Promise.all([
        this.distributorOfferModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
        this.distributorOfferModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        success: true,
        message: 'Distributor offers retrieved successfully',
        data: offers.map((offer) => this.formatOfferResponseWithCollected(offer)),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve distributor offers: ${error.message}`,
        data: [],
      };
    }
  }

  async deleteOffer(data: DeleteDistributorOfferDto): Promise<DeleteDistributorOfferResponseDto> {
    try {
      const result = await this.distributorOfferModel.findByIdAndDelete(data.id).exec();

      if (!result) {
        return {
          success: false,
          message: 'Distributor offer not found',
        };
      }

      return {
        success: true,
        message: 'Distributor offer deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete distributor offer: ${error.message}`,
      };
    }
  }

  async incrementCollectedQuantity(offerId: string, quantity: number): Promise<void> {
    await this.distributorOfferModel.findByIdAndUpdate(
      offerId,
      { $inc: { collectedQuantity: quantity } },
      { new: true }
    ).exec();
  }

  private formatOfferResponse(offer: any) {
    return {
      id: offer._id.toString(),
      _id: offer._id.toString(),
      userId: offer.userId,
      pricePerKilo: offer.pricePerKilo,
      targetQuantity: offer.targetQuantity,
      collectedQuantity: offer.collectedQuantity || 0,
      totalInvestment: offer.totalInvestment,
      status: offer.status,
      requirement: offer.requirement,
      createdAt: offer.createdAt ? offer.createdAt.toString() : '',
      updatedAt: offer.updatedAt ? offer.updatedAt.toString() : '',
    };
  }

  private formatOfferResponseWithCollected(offer: any) {
    return {
      id: offer._id.toString(),
      _id: offer._id.toString(),
      userId: offer.userId,
      pricePerKilo: offer.pricePerKilo,
      targetQuantity: offer.targetQuantity,
      collectedQuantity: offer.collectedQuantity || 0,
      totalInvestment: offer.totalInvestment,
      status: offer.status,
      requirement: offer.requirement,
      createdAt: offer.createdAt ? offer.createdAt.toString() : '',
      updatedAt: offer.updatedAt ? offer.updatedAt.toString() : '',
    };
  }
}
