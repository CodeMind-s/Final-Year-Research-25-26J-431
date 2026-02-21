import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal, DealStatus } from './schemas/deal.schema';
import { DistributorOffer } from '../distributor-offers/schemas/distributor-offer.schema';
import { DistributorOfferService } from '../distributor-offers/distributor-offer.service';
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

@Injectable()
export class DealService {
  constructor(
    @InjectModel(Deal.name)
    private dealModel: Model<Deal>,
    @InjectModel(DistributorOffer.name)
    private distributorOfferModel: Model<DistributorOffer>,
    private distributorOfferService: DistributorOfferService
  ) {}

  async createDeal(data: CreateDealDto): Promise<CreateDealResponseDto> {
    try {
      // Fetch the offer to get distributorId
      const offer = await this.distributorOfferModel.findById(data.offerId).exec();
      
      if (!offer) {
        return {
          success: false,
          message: 'Distributor offer not found',
        };
      }

      const deal = new this.dealModel({
        landownerId: data.landownerId,
        distributorId: offer.userId, // Get distributorId from the offer
        offerId: data.offerId,
        quantity: data.quantity,
        pricePerKilo: offer.pricePerKilo,
        status: DealStatus.DRAFT,
      });

      const savedDeal = await deal.save();
      const populatedDeal = await this.dealModel
        .findById(savedDeal._id)
        .populate('offerId')
        .exec();

      return {
        success: true,
        message: 'Deal created successfully',
        data: this.formatDealResponse(populatedDeal),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create deal: ${error.message}`,
      };
    }
  }

  async updateDeal(data: UpdateDealDto): Promise<UpdateDealResponseDto> {
    try {
      const deal = await this.dealModel.findById(data.id).exec();

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found',
        };
      }

      const previousStatus = deal.status;

      // Update only provided fields
      if (data.quantity !== undefined) deal.quantity = data.quantity;
      if (data.pricePerKilo !== undefined) deal.pricePerKilo = data.pricePerKilo;
      if (data.status !== undefined) {
        deal.status = data.status;
        
        // If status is changed to ACCEPTED, set acceptedAt and update offer collected quantity
        if (data.status === DealStatus.ACCEPTED && previousStatus !== DealStatus.ACCEPTED) {
          deal.acceptedAt = new Date();
          
          // Increment collected quantity in distributor offer
          await this.distributorOfferService.incrementCollectedQuantity(
            deal.offerId.toString(),
            deal.quantity
          );
        }
      }

      const updatedDeal = await deal.save();
      const populatedDeal = await this.dealModel
        .findById(updatedDeal._id)
        .populate('offerId')
        .exec();

      return {
        success: true,
        message: 'Deal updated successfully',
        data: this.formatDealResponse(populatedDeal),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update deal: ${error.message}`,
      };
    }
  }

  async getDeal(data: GetDealDto): Promise<GetDealResponseDto> {
    try {
      const deal = await this.dealModel.findById(data.id).populate('offerId').exec();

      if (!deal) {
        return {
          success: false,
          message: 'Deal not found',
        };
      }

      return {
        success: true,
        message: 'Deal retrieved successfully',
        data: this.formatDealResponse(deal),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve deal: ${error.message}`,
      };
    }
  }

  async getDeals(data: GetDealsDto): Promise<GetDealsResponseDto> {
    try {
      const filter: any = {};

      // Build filter object - only add non-null/undefined values
      if (data.landownerId && data.landownerId.trim()) {
        filter.landownerId = data.landownerId;
      }
      if (data.distributorId && data.distributorId.trim()) {
        filter.distributorId = data.distributorId;
      }
      if (data.status && data.status.trim()) {
        filter.status = data.status;
      }

      // Pagination
      const page = data.page && data.page >= 1 ? data.page : 1;
      const limit = data.limit && data.limit > 0 ? data.limit : 10;
      const skip = (page - 1) * limit;

      const [deals, totalItems] = await Promise.all([
        this.dealModel.find(filter).populate('offerId').skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
        this.dealModel.countDocuments(filter).exec(),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        success: true,
        message: 'Deals retrieved successfully',
        data: deals.map((deal) => this.formatDealResponse(deal)),
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
        message: `Failed to retrieve deals: ${error.message}`,
        data: [],
      };
    }
  }

  async deleteDeal(data: DeleteDealDto): Promise<DeleteDealResponseDto> {
    try {
      const result = await this.dealModel.findByIdAndDelete(data.id).exec();

      if (!result) {
        return {
          success: false,
          message: 'Deal not found',
        };
      }

      return {
        success: true,
        message: 'Deal deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete deal: ${error.message}`,
      };
    }
  }

  private formatDealResponse(deal: any) {
    return {
      id: deal._id.toString(),
      _id: deal._id.toString(),
      landownerId: deal.landownerId,
      distributorId: deal.distributorId,
      offerId: deal.offerId?._id ? deal.offerId._id.toString() : deal.offerId?.toString() || '',
      quantity: deal.quantity,
      pricePerKilo: deal.pricePerKilo,
      status: deal.status,
      acceptedAt: deal.acceptedAt ? deal.acceptedAt.toString() : '',
      createdAt: deal.createdAt ? deal.createdAt.toString() : '',
      updatedAt: deal.updatedAt ? deal.updatedAt.toString() : '',
      offer: deal.offerId && typeof deal.offerId === 'object' ? {
        _id: deal.offerId._id?.toString() || '',
        userId: deal.offerId.userId || '',
        pricePerKilo: deal.offerId.pricePerKilo || 0,
        targetQuantity: deal.offerId.targetQuantity || 0,
        collectedQuantity: deal.offerId.collectedQuantity || 0,
        totalInvestment: deal.offerId.totalInvestment || 0,
        status: deal.offerId.status || '',
        requirement: deal.offerId.requirement || '',
        createdAt: deal.offerId.createdAt ? deal.offerId.createdAt.toString() : '',
        updatedAt: deal.offerId.updatedAt ? deal.offerId.updatedAt.toString() : '',
      } : null,
    };
  }
}
