import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SellerProfile } from './schemas/seller-profile.schema';
import { SellerOfferModel } from './schemas/seller-offer.schema';
import { MarketDemandTrend } from './schemas/market-demand-trend.schema';
import { LandownerProfile } from '../landowner/schemas/landowner-profile.schema';
import { Deal } from '../landowner/schemas/deal.schema';
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

@Injectable()
export class SellerService {
  constructor(
    @InjectModel(SellerProfile.name)
    private sellerProfileModel: Model<SellerProfile>,
    @InjectModel(SellerOfferModel.name)
    private sellerOfferModel: Model<SellerOfferModel>,
    @InjectModel(MarketDemandTrend.name)
    private marketDemandTrendModel: Model<MarketDemandTrend>,
    @InjectModel(LandownerProfile.name)
    private landownerProfileModel: Model<LandownerProfile>,
    @InjectModel(Deal.name)
    private dealModel: Model<Deal>
  ) {}

  async getSellerProfile(
    data: GetSellerProfileRequestDto
  ): Promise<GetSellerProfileResponseDto> {
    try {
      const profile = await this.sellerProfileModel.findOne({
        sellerId: data.sellerId,
      });

      if (!profile) {
        return {
          success: false,
          message: `Seller profile not found for ID: ${data.sellerId}`,
        };
      }

      return {
        success: true,
        message: 'Seller profile fetched successfully',
        data: {
          id: profile.sellerId,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          reliability: profile.reliability,
          totalPurchased: profile.totalPurchased,
          activeCampaigns: profile.activeCampaigns,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch seller profile: ${error.message}`
      );
    }
  }

  async getMarketDemandTrends(
    data: GetMarketDemandTrendsRequestDto
  ): Promise<GetMarketDemandTrendsResponseDto> {
    try {
      // Generate mock market demand trends
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonthIndex = new Date().getMonth();
      
      const trends = [];
      for (let i = data.months - 1; i >= 0; i--) {
        const monthIndex = (currentMonthIndex - i + 12) % 12;
        trends.push({
          month: months[monthIndex],
          demand: 1000 + Math.random() * 500,
        });
      }

      const currentDemand = trends[trends.length - 1].demand;
      const previousDemand = trends[trends.length - 2]?.demand || currentDemand;
      const trendDirection = currentDemand > previousDemand * 1.05 ? 'up' : 
                            currentDemand < previousDemand * 0.95 ? 'down' : 'stable';

      await this.marketDemandTrendModel.findOneAndUpdate(
        { region: data.region },
        { trends, currentDemand, trend: trendDirection },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Market demand trends fetched successfully',
        trends,
        currentDemand,
        trend: trendDirection,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get market demand trends: ${error.message}`
      );
    }
  }

  async createOffer(
    data: CreateOfferRequestDto
  ): Promise<CreateOfferResponseDto> {
    try {
      const offer = await this.sellerOfferModel.create({
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        pricePerTon: data.pricePerTon,
        demandTons: data.demandTons,
        reliability: data.reliability,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: 'Offer published successfully',
        offerId: offer._id.toString(),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create offer: ${error.message}`);
    }
  }

  async getCurrentOffer(
    data: GetCurrentOfferRequestDto
  ): Promise<GetCurrentOfferResponseDto> {
    try {
      const offer = await this.sellerOfferModel
        .findOne({ sellerId: data.sellerId })
        .sort({ timestamp: -1 });

      if (!offer) {
        return {
          success: false,
          message: `No current offer found for seller: ${data.sellerId}`,
        };
      }

      return {
        success: true,
        message: 'Current offer fetched successfully',
        offer: {
          id: offer._id.toString(),
          sellerId: offer.sellerId,
          pricePerTon: offer.pricePerTon,
          demandTons: offer.demandTons,
          reliability: offer.reliability,
          timestamp: offer.timestamp,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get current offer: ${error.message}`
      );
    }
  }

  async updateOffer(
    data: UpdateOfferRequestDto
  ): Promise<UpdateOfferResponseDto> {
    try {
      const offer = await this.sellerOfferModel.findByIdAndUpdate(
        data.offerId,
        {
          pricePerTon: data.pricePerTon,
          demandTons: data.demandTons,
          timestamp: Date.now(),
        },
        { new: true }
      );

      if (!offer) {
        return {
          success: false,
          message: `Offer not found with ID: ${data.offerId}`,
        };
      }

      return {
        success: true,
        message: 'Offer updated successfully',
        updatedOffer: {
          id: offer._id.toString(),
          sellerId: offer.sellerId,
          pricePerTon: offer.pricePerTon,
          demandTons: offer.demandTons,
          reliability: offer.reliability,
          timestamp: offer.timestamp,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update offer: ${error.message}`);
    }
  }

  async deleteOffer(
    data: DeleteOfferRequestDto
  ): Promise<DeleteOfferResponseDto> {
    try {
      const result = await this.sellerOfferModel.findByIdAndDelete(data.offerId);

      if (!result) {
        return {
          success: false,
          message: `Offer not found with ID: ${data.offerId}`,
        };
      }

      return {
        success: true,
        message: 'Offer deleted successfully',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete offer: ${error.message}`);
    }
  }

  async getAvailableLandowners(
    data: GetAvailableLandownersRequestDto
  ): Promise<GetAvailableLandownersResponseDto> {
    try {
      const landowners = await this.landownerProfileModel.find({
        availableTons: { $gt: 0 },
      });

      return {
        success: true,
        message: `Found ${landowners.length} available landowners`,
        landowners: landowners.map((landowner) => ({
          id: landowner.landownerId,
          name: landowner.name,
          productionTons: landowner.totalProductionTons,
          availableTons: landowner.availableTons,
          harvestDate: new Date().toISOString().split('T')[0],
          priority: landowner.availableTons > 100,
        })),
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get available landowners: ${error.message}`
      );
    }
  }

  async getSellerDeals(
    data: GetSellerDealsRequestDto
  ): Promise<GetSellerDealsResponseDto> {
    try {
      const query: any = { sellerId: data.sellerId };

      if (data.status !== 'all') {
        query.status = data.status;
      }

      const deals = await this.dealModel.find(query).sort({ createdAt: -1 });

      const securedTons = deals
        .filter((d) => d.status === 'accepted' || d.status === 'completed')
        .reduce((sum, d) => sum + d.totalQuantity, 0);

      // Assume target is from current offer
      const currentOffer = await this.sellerOfferModel
        .findOne({ sellerId: data.sellerId })
        .sort({ timestamp: -1 });
      const targetTons = currentOffer?.demandTons || 0;
      const remainingTons = Math.max(0, targetTons - securedTons);

      return {
        success: true,
        message: `Found ${deals.length} deals`,
        deals: deals.map((deal) => ({
          id: deal._id.toString(),
          sellerId: deal.sellerId,
          sellerName: deal.sellerName,
          landownerId: deal.landownerId,
          landownerName: deal.landownerName,
          quantity: deal.totalQuantity,
          pricePerTon: deal.totalRevenue / deal.totalQuantity,
          totalPrice: deal.totalRevenue,
          status: deal.status,
          createdAt: deal.createdAt?.getTime() || Date.now(),
          acceptedAt: deal.acceptedAt,
          completedAt: deal.completedAt,
        })),
        securedTons,
        remainingTons,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get seller deals: ${error.message}`
      );
    }
  }

  async getDealProgress(
    data: GetDealProgressRequestDto
  ): Promise<GetDealProgressResponseDto> {
    try {
      const currentOffer = await this.sellerOfferModel
        .findOne({ sellerId: data.sellerId })
        .sort({ timestamp: -1 });

      const targetQuantity = currentOffer?.demandTons || 0;

      const deals = await this.dealModel.find({
        sellerId: data.sellerId,
        status: { $in: ['accepted', 'completed'] },
      });

      const securedTons = deals.reduce((sum, d) => sum + d.totalQuantity, 0);
      const remainingTons = Math.max(0, targetQuantity - securedTons);
      const progressPercentage = targetQuantity > 0 
        ? Math.min(100, (securedTons / targetQuantity) * 100) 
        : 0;

      return {
        success: true,
        message: 'Deal progress fetched successfully',
        targetQuantity,
        securedTons,
        remainingTons,
        progressPercentage,
        activeDealCount: deals.length,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get deal progress: ${error.message}`
      );
    }
  }
}
