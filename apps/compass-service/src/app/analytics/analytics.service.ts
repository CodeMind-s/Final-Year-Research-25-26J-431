import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deal } from '../landowner/schemas/deal.schema';
import {
  GetLandownerAnalyticsRequestDto,
  GetLandownerAnalyticsResponseDto,
  GetSellerAnalyticsRequestDto,
  GetSellerAnalyticsResponseDto,
} from './dtos/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Deal.name)
    private dealModel: Model<Deal>
  ) {}

  async getLandownerAnalytics(
    data: GetLandownerAnalyticsRequestDto
  ): Promise<GetLandownerAnalyticsResponseDto> {
    try {
      const periodMs = this.getPeriodInMs(data.period);
      const startDate = new Date(Date.now() - periodMs);

      const deals = await this.dealModel.find({
        landownerId: data.landownerId,
        status: { $in: ['accepted', 'completed'] },
        createdAt: { $gte: startDate },
      });

      const totalRevenue = deals.reduce((sum, d) => sum + d.totalRevenue, 0);
      const totalProfit = deals.reduce((sum, d) => sum + d.netProfit, 0);
      const totalTonsSold = deals.reduce((sum, d) => sum + d.totalQuantity, 0);
      const averagePricePerTon = totalTonsSold > 0 ? totalRevenue / totalTonsSold : 0;

      // Calculate top buyers
      const buyerMap = new Map<string, { name: string; tons: number }>();
      deals.forEach((deal) => {
        const existing = buyerMap.get(deal.sellerId) || { name: deal.sellerName, tons: 0 };
        existing.tons += deal.totalQuantity;
        buyerMap.set(deal.sellerId, existing);
      });

      const topBuyers = Array.from(buyerMap.entries())
        .map(([sellerId, data]) => ({
          sellerId,
          sellerName: data.name,
          totalTonsPurchased: data.tons,
        }))
        .sort((a, b) => b.totalTonsPurchased - a.totalTonsPurchased)
        .slice(0, 5);

      return {
        success: true,
        message: 'Landowner analytics fetched successfully',
        totalRevenue,
        totalProfit,
        totalTonsSold,
        averagePricePerTon,
        dealCount: deals.length,
        topBuyers,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get landowner analytics: ${error.message}`
      );
    }
  }

  async getSellerAnalytics(
    data: GetSellerAnalyticsRequestDto
  ): Promise<GetSellerAnalyticsResponseDto> {
    try {
      const periodMs = this.getPeriodInMs(data.period);
      const startDate = new Date(Date.now() - periodMs);

      const deals = await this.dealModel.find({
        sellerId: data.sellerId,
        status: { $in: ['accepted', 'completed'] },
        createdAt: { $gte: startDate },
      });

      const totalInvestment = deals.reduce((sum, d) => sum + d.totalRevenue, 0);
      const totalTonsPurchased = deals.reduce((sum, d) => sum + d.totalQuantity, 0);
      const averagePricePerTon = totalTonsPurchased > 0 ? totalInvestment / totalTonsPurchased : 0;

      // Calculate top suppliers
      const supplierMap = new Map<string, { name: string; tons: number }>();
      deals.forEach((deal) => {
        const existing = supplierMap.get(deal.landownerId) || { name: deal.landownerName, tons: 0 };
        existing.tons += deal.totalQuantity;
        supplierMap.set(deal.landownerId, existing);
      });

      const topSuppliers = Array.from(supplierMap.entries())
        .map(([landownerId, data]) => ({
          landownerId,
          landownerName: data.name,
          totalTonsSold: data.tons,
        }))
        .sort((a, b) => b.totalTonsSold - a.totalTonsSold)
        .slice(0, 5);

      return {
        success: true,
        message: 'Seller analytics fetched successfully',
        totalInvestment,
        totalTonsPurchased,
        averagePricePerTon,
        dealCount: deals.length,
        topSuppliers,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get seller analytics: ${error.message}`
      );
    }
  }

  private getPeriodInMs(period: string): number {
    switch (period) {
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      case 'year':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }
}
