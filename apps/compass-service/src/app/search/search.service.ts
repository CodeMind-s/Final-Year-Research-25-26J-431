import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SellerProfile } from '../seller/schemas/seller-profile.schema';
import { SellerOfferModel } from '../seller/schemas/seller-offer.schema';
import { LandownerProfile } from '../landowner/schemas/landowner-profile.schema';
import {
  SearchSellersRequestDto,
  SearchSellersResponseDto,
  SearchLandownersRequestDto,
  SearchLandownersResponseDto,
} from './dtos/search.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(SellerProfile.name)
    private sellerProfileModel: Model<SellerProfile>,
    @InjectModel(SellerOfferModel.name)
    private sellerOfferModel: Model<SellerOfferModel>,
    @InjectModel(LandownerProfile.name)
    private landownerProfileModel: Model<LandownerProfile>
  ) {}

  async searchSellers(
    data: SearchSellersRequestDto
  ): Promise<SearchSellersResponseDto> {
    try {
      const query: any = {};

      if (data.name) {
        query.name = { $regex: data.name, $options: 'i' };
      }

      if (data.reliability) {
        query.reliability = data.reliability;
      }

      const sellers = await this.sellerProfileModel.find(query);

      // Get current offers for each seller
      const results = await Promise.all(
        sellers.map(async (seller) => {
          const offer = await this.sellerOfferModel
            .findOne({ sellerId: seller.sellerId })
            .sort({ timestamp: -1 });

          // Apply price filter if specified
          if (data.minPrice && offer && offer.pricePerTon < data.minPrice) {
            return null;
          }
          if (data.maxPrice && offer && offer.pricePerTon > data.maxPrice) {
            return null;
          }

          return {
            id: seller.sellerId,
            name: seller.name,
            email: seller.email,
            phone: seller.phone,
            reliability: seller.reliability,
            currentPricePerTon: offer?.pricePerTon || 0,
            demandTons: offer?.demandTons || 0,
          };
        })
      );

      const filteredResults = results.filter((r) => r !== null);

      return {
        success: true,
        message: `Found ${filteredResults.length} sellers`,
        sellers: filteredResults,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to search sellers: ${error.message}`
      );
    }
  }

  async searchLandowners(
    data: SearchLandownersRequestDto
  ): Promise<SearchLandownersResponseDto> {
    try {
      const query: any = {};

      if (data.name) {
        query.name = { $regex: data.name, $options: 'i' };
      }

      if (data.minTons) {
        query.availableTons = { $gte: data.minTons };
      }

      const landowners = await this.landownerProfileModel.find(query);

      const results = landowners.map((landowner) => {
        const priority = data.priority !== undefined 
          ? landowner.availableTons > 100 && data.priority
          : landowner.availableTons > 100;

        // Filter by priority if specified
        if (data.priority !== undefined && priority !== data.priority) {
          return null;
        }

        return {
          id: landowner.landownerId,
          name: landowner.name,
          email: landowner.email,
          phone: landowner.phone,
          totalProductionTons: landowner.totalProductionTons,
          availableTons: landowner.availableTons,
          priority,
        };
      }).filter((r) => r !== null);

      return {
        success: true,
        message: `Found ${results.length} landowners`,
        landowners: results,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to search landowners: ${error.message}`
      );
    }
  }
}
