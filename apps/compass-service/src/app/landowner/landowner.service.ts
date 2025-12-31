import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LandownerProfile } from './schemas/landowner-profile.schema';
import { ProductionCosts } from './schemas/production-costs.schema';
import { HarvestPrediction } from './schemas/harvest-prediction.schema';
import { PricePrediction } from './schemas/price-prediction.schema';
import { DemandPrediction } from './schemas/demand-prediction.schema';
import { SellerRecommendation } from './schemas/seller-recommendation.schema';
import { SellerOffer } from './schemas/seller-offer.schema';
import { Deal } from './schemas/deal.schema';
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

@Injectable()
export class LandownerService {
  constructor(
    @InjectModel(LandownerProfile.name)
    private landownerProfileModel: Model<LandownerProfile>,
    @InjectModel(ProductionCosts.name)
    private productionCostsModel: Model<ProductionCosts>,
    @InjectModel(HarvestPrediction.name)
    private harvestPredictionModel: Model<HarvestPrediction>,
    @InjectModel(PricePrediction.name)
    private pricePredictionModel: Model<PricePrediction>,
    @InjectModel(DemandPrediction.name)
    private demandPredictionModel: Model<DemandPrediction>,
    @InjectModel(SellerRecommendation.name)
    private sellerRecommendationModel: Model<SellerRecommendation>,
    @InjectModel(SellerOffer.name)
    private sellerOfferModel: Model<SellerOffer>,
    @InjectModel(Deal.name)
    private dealModel: Model<Deal>
  ) {}

  async getLandownerProfile(
    data: GetLandownerProfileRequestDto
  ): Promise<GetLandownerProfileResponseDto> {
    try {
      const profile = await this.landownerProfileModel.findOne({
        landownerId: data.landownerId,
      });

      if (!profile) {
        return {
          success: false,
          message: `Landowner profile not found for ID: ${data.landownerId}`,
        };
      }

      return {
        success: true,
        message: 'Landowner profile fetched successfully',
        data: {
          id: profile.landownerId,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          totalProductionTons: profile.totalProductionTons,
          availableTons: profile.availableTons,
          soldTons: profile.soldTons,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch landowner profile: ${error.message}`
      );
    }
  }

  async updateProductionCosts(
    data: UpdateProductionCostsRequestDto
  ): Promise<UpdateProductionCostsResponseDto> {
    try {
      const costs = await this.productionCostsModel.findOneAndUpdate(
        { landownerId: data.landownerId },
        {
          fertilizerCost: data.fertilizerCost,
          laborCost: data.laborCost,
          transportCost: data.transportCost,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Production costs updated successfully',
        costs: {
          fertilizerCost: costs.fertilizerCost,
          laborCost: costs.laborCost,
          transportCost: costs.transportCost,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to update production costs: ${error.message}`
      );
    }
  }

  async getHarvestPrediction(
    data: GetHarvestPredictionRequestDto
  ): Promise<GetHarvestPredictionResponseDto> {
    try {
      // TODO: Integrate with ML service for actual predictions
      // For now, return mock predictions based on historical data
      const predictions = data.past6Months.map((month, index) => ({
        month: this.getNextMonth(month.month, index + 1),
        tons: month.tons * (1 + Math.random() * 0.2 - 0.1), // ±10% variation
        isPrediction: true,
        confidence: 0.75 + Math.random() * 0.2, // 75-95% confidence
      }));

      const historicalData = data.past6Months.map((month) => ({
        month: month.month,
        tons: month.tons,
        isPrediction: false,
      }));

      // Save to database
      await this.harvestPredictionModel.findOneAndUpdate(
        { landownerId: data.landownerId },
        {
          predictions,
          historicalData,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Harvest predictions generated successfully',
        predictions,
        historicalData,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get harvest prediction: ${error.message}`
      );
    }
  }

  async getPricePrediction(
    data: GetPricePredictionRequestDto
  ): Promise<GetPricePredictionResponseDto> {
    try {
      // TODO: Integrate with ML service for actual predictions
      // For now, return mock predictions
      const predictions = data.historicalPrices.map((price, index) => ({
        month: this.getNextMonth(price.month, index + 1),
        avgPrice: price.avgPrice * (1 + Math.random() * 0.15 - 0.05),
        minPrice: price.avgPrice * 0.9,
        maxPrice: price.avgPrice * 1.1,
        isPrediction: true,
      }));

      const historicalData = data.historicalPrices.map((price) => ({
        month: price.month,
        avgPrice: price.avgPrice,
        minPrice: price.avgPrice * 0.95,
        maxPrice: price.avgPrice * 1.05,
        isPrediction: false,
      }));

      // Save to database
      await this.pricePredictionModel.findOneAndUpdate(
        { region: data.region },
        {
          predictions,
          historicalData,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Price predictions generated successfully',
        predictions,
        historicalData,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get price prediction: ${error.message}`
      );
    }
  }

  async getDemandPrediction(
    data: GetDemandPredictionRequestDto
  ): Promise<GetDemandPredictionResponseDto> {
    try {
      // TODO: Integrate with ML service for actual predictions
      // Mock predictions for now
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const currentMonthIndex = new Date().getMonth();

      const historicalData = [];
      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonthIndex - i + 12) % 12;
        historicalData.push({
          month: months[monthIndex],
          demandTons: 1000 + Math.random() * 500,
          isPrediction: false,
        });
      }

      const predictions = [];
      for (let i = 1; i <= 6; i++) {
        const monthIndex = (currentMonthIndex + i) % 12;
        const baseDemand = 1000 + Math.random() * 500;
        predictions.push({
          month: months[monthIndex],
          demandTons: baseDemand,
          isPrediction: true,
          trend:
            baseDemand > 1250
              ? 'increasing'
              : baseDemand < 1100
              ? 'decreasing'
              : 'stable',
        });
      }

      // Save to database
      await this.demandPredictionModel.findOneAndUpdate(
        { region: data.region, productType: data.productType },
        {
          predictions,
          historicalData,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Demand predictions generated successfully',
        predictions,
        historicalData,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get demand prediction: ${error.message}`
      );
    }
  }

  async getSellerRecommendations(
    data: GetSellerRecommendationsRequestDto
  ): Promise<GetSellerRecommendationsResponseDto> {
    try {
      // TODO: Integrate with ML service for actual recommendations
      // Mock recommendations for now
      const recommendations = [
        {
          seller_id: 1,
          sellerName: 'Premium Salt Traders',
          confidence: 0.92,
          confidence_percentage: '92%',
          ranking: 1,
        },
        {
          seller_id: 2,
          sellerName: 'Coastal Minerals Ltd',
          confidence: 0.85,
          confidence_percentage: '85%',
          ranking: 2,
        },
        {
          seller_id: 3,
          sellerName: 'Ocean Harvest Co',
          confidence: 0.78,
          confidence_percentage: '78%',
          ranking: 3,
        },
      ];

      // Save to database
      await this.sellerRecommendationModel.findOneAndUpdate(
        { landownerId: data.landownerId },
        {
          availableTons: data.availableTons,
          region: data.region,
          recommendations,
        },
        { upsert: true, new: true }
      );

      return {
        success: true,
        message: 'Seller recommendations generated successfully',
        recommendations,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get seller recommendations: ${error.message}`
      );
    }
  }

  async getSellerOffers(
    data: GetSellerOffersRequestDto
  ): Promise<GetSellerOffersResponseDto> {
    try {
      const offers = await this.sellerOfferModel.find().sort({ timestamp: -1 });

      return {
        success: true,
        message: `Found ${offers.length} seller offers`,
        offers: offers.map((offer) => ({
          id: offer._id.toString(),
          sellerId: offer.sellerId,
          sellerName: offer.sellerName,
          pricePerTon: offer.pricePerTon,
          demandTons: offer.demandTons,
          reliability: offer.reliability,
          isRecommended: offer.isRecommended,
          timestamp: offer.timestamp,
        })),
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get seller offers: ${error.message}`
      );
    }
  }

  async createDeal(
    data: CreateDealRequestDto
  ): Promise<CreateDealResponseDto> {
    try {
      const deal = await this.dealModel.create({
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        landownerId: data.landownerId,
        landownerName: data.landownerName,
        allocations: data.allocations,
        totalQuantity: data.totalQuantity,
        totalRevenue: data.totalRevenue,
        productionCosts: data.productionCosts,
        netProfit: data.netProfit,
        status: data.status,
        acceptedAt: data.status === 'accepted' ? Date.now() : undefined,
        negotiations: [],
      });

      return {
        success: true,
        message: 'Deal created successfully',
        dealId: deal._id.toString(),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create deal: ${error.message}`);
    }
  }

  async getDeals(data: GetDealsRequestDto): Promise<GetDealsResponseDto> {
    try {
      const query: any = { landownerId: data.landownerId };

      if (data.status !== 'all') {
        query.status = data.status;
      }

      const deals = await this.dealModel.find(query).sort({ createdAt: -1 });

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
          pricePerTon:
            deal.totalRevenue / deal.totalQuantity,
          totalPrice: deal.totalRevenue,
          productionCosts: deal.productionCosts,
          netProfit: deal.netProfit,
          status: deal.status,
          createdAt: deal.createdAt?.getTime() || Date.now(),
          acceptedAt: deal.acceptedAt,
          completedAt: deal.completedAt,
          negotiations: deal.negotiations || [],
        })),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get deals: ${error.message}`);
    }
  }

  async updateDealStatus(
    data: UpdateDealStatusRequestDto
  ): Promise<UpdateDealStatusResponseDto> {
    try {
      const updateData: any = { status: data.status };

      if (data.status === 'completed') {
        updateData.completedAt = Date.now();
      }

      const deal = await this.dealModel.findByIdAndUpdate(
        data.dealId,
        updateData,
        { new: true }
      );

      if (!deal) {
        return {
          success: false,
          message: `Deal not found with ID: ${data.dealId}`,
        };
      }

      return {
        success: true,
        message: 'Deal status updated successfully',
        updatedDeal: {
          id: deal._id.toString(),
          sellerId: deal.sellerId,
          sellerName: deal.sellerName,
          landownerId: deal.landownerId,
          landownerName: deal.landownerName,
          quantity: deal.totalQuantity,
          pricePerTon: deal.totalRevenue / deal.totalQuantity,
          totalPrice: deal.totalRevenue,
          productionCosts: deal.productionCosts,
          netProfit: deal.netProfit,
          status: deal.status,
          createdAt: deal.createdAt?.getTime() || Date.now(),
          acceptedAt: deal.acceptedAt,
          completedAt: deal.completedAt,
          negotiations: deal.negotiations || [],
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to update deal status: ${error.message}`
      );
    }
  }

  // Helper method to calculate next month
  private getNextMonth(currentMonth: string, monthsAhead: number): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const currentIndex = months.indexOf(currentMonth);
    if (currentIndex === -1) return currentMonth;
    return months[(currentIndex + monthsAhead) % 12];
  }
}
