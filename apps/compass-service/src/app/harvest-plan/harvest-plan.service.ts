import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HarvestPlan, HarvestStatus } from './schemas/harvest-plan.schema';
import { DistributorOffer } from '../distributor-offers/schemas/distributor-offer.schema';
import {
  CreatePlanDto,
  CreatePlanResponseDto,
  GetPlanDto,
  GetPlanResponseDto,
  GetPlansDto,
  GetPlansResponseDto,
  UpdatePlanDto,
  UpdatePlanResponseDto,
  DeletePlanDto,
  DeletePlanResponseDto,
  GetDemandPriceDto,
  GetDemandPriceResponseDto,
} from './dtos/harvest-plan.dto';

@Injectable()
export class HarvestPlanService {
  constructor(
    @InjectModel(HarvestPlan.name)
    private harvestPlanModel: Model<HarvestPlan>,
    @InjectModel(DistributorOffer.name)
    private distributorOfferModel: Model<DistributorOffer>,
  ) {}

  async CreatePlan(data: CreatePlanDto): Promise<CreatePlanResponseDto> {
    try {
      // Calculate end date based on start date and plan period
      const startDate = new Date(data.startDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + data.planPeriod);

      // Map enum from proto (number) to Mongoose (string)
      const harvestStatusMap: Record<number, HarvestStatus> = {
        0: HarvestStatus.FRESHER,
        1: HarvestStatus.MIDLEVEL,
        2: HarvestStatus.HARVESTED,
        3: HarvestStatus.DISPOSED,
      };

      const plan = new this.harvestPlanModel({
        userId: data.userId,
        saltBeds: data.saltBeds,
        harvestStatus: harvestStatusMap[data.harvestStatus] || HarvestStatus.FRESHER,
        planPeriod: data.planPeriod,
        startDate: startDate,
        endDate: endDate,
        predictedProduction: data.predictedProduction || 0,
        actualProduction: data.actualProduction || 0,
        workerCount: data.workerCount || 0,
        predictedProfit: data.predictedProfit || 0,
        actualProfit: data.actualProfit || 0,
        expenses: data.expenses || 0,
        earnings: data.earnings || 0,
        avgSellingPrice: data.avgSellingPrice || 0,
      });

      const savedPlan = await plan.save();

      return {
        success: true,
        message: 'Harvest plan created successfully',
        data: this.formatPlanResponse(savedPlan),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create harvest plan: ${error.message}`,
      };
    }
  }

  async GetPlan(data: GetPlanDto): Promise<GetPlanResponseDto> {
    try {
      const plan = await this.harvestPlanModel.findById(data.id).exec();

      if (!plan) {
        return {
          success: false,
          message: 'Harvest plan not found',
        };
      }

      return {
        success: true,
        message: 'Harvest plan retrieved successfully',
        data: this.formatPlanResponse(plan),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve harvest plan: ${error.message}`,
      };
    }
  }

  async GetPlans(data: GetPlansDto): Promise<GetPlansResponseDto> {
    try {
      const filter: any = {};
      
      // Build filter object - only add non-null/undefined values
      if (data.userId && data.userId.trim()) {
        filter.userId = data.userId;
      }
      
      if (data.status && data.status.trim()) {
        filter.harvestStatus = data.status.toUpperCase();
      }
      
      // Handle date range filtering
      const hasStartDate = data.startDate && data.startDate.trim();
      const hasEndDate = data.endDate && data.endDate.trim();
      
      if (hasStartDate || hasEndDate) {
        filter.startDate = {};
        if (hasStartDate && data.startDate) filter.startDate.$gte = new Date(data.startDate);
        if (hasEndDate && data.endDate) filter.startDate.$lte = new Date(data.endDate);
      }

      // Build query with optional pagination (1-based page numbering)
      let query = this.harvestPlanModel.find(filter);
      
      if (data.page !== undefined && data.page !== null && data.page >= 1 && data.limit !== undefined && data.limit !== null && data.limit > 0) {
        // Convert 1-based page to 0-based skip (page 1 = skip 0, page 2 = skip limit, etc.)
        const skip = (data.page - 1) * data.limit;
        query = query.skip(skip).limit(data.limit);
      }
      
      const plans = await query.exec();

      return {
        success: true,
        message: 'Harvest plans retrieved successfully',
        data: plans.map((plan) => this.formatPlanResponse(plan)),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve harvest plans: ${error.message}`,
        data: [],
      };
    }
  }

  async UpdatePlan(data: UpdatePlanDto): Promise<UpdatePlanResponseDto> {
    try {
      const updateData: any = {};

      if (data.saltBeds !== undefined) updateData.saltBeds = data.saltBeds;
      if (data.harvestStatus !== undefined) {
        const harvestStatusMap: Record<number, HarvestStatus> = {
          0: HarvestStatus.FRESHER,
          1: HarvestStatus.MIDLEVEL,
          2: HarvestStatus.HARVESTED,
          3: HarvestStatus.DISPOSED,
        };
        updateData.harvestStatus = harvestStatusMap[data.harvestStatus];
      }
      if (data.planPeriod !== undefined) updateData.planPeriod = data.planPeriod;
      if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
      
      // Recalculate end date if start date or plan period changes
      if (data.startDate !== undefined || data.planPeriod !== undefined) {
        const plan = await this.harvestPlanModel.findById(data.id);
        if (plan) {
          const startDate = data.startDate !== undefined ? new Date(data.startDate) : plan.startDate;
          const planPeriod = data.planPeriod !== undefined ? data.planPeriod : plan.planPeriod;
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + planPeriod);
          updateData.endDate = endDate;
        }
      }
      
      if (data.predictedProduction !== undefined)
        updateData.predictedProduction = data.predictedProduction;
      if (data.actualProduction !== undefined)
        updateData.actualProduction = data.actualProduction;
      if (data.workerCount !== undefined) updateData.workerCount = data.workerCount;
      if (data.predictedProfit !== undefined)
        updateData.predictedProfit = data.predictedProfit;
      if (data.actualProfit !== undefined) updateData.actualProfit = data.actualProfit;
      if (data.expenses !== undefined) updateData.expenses = data.expenses;
      if (data.earnings !== undefined) updateData.earnings = data.earnings;
      if (data.avgSellingPrice !== undefined)
        updateData.avgSellingPrice = data.avgSellingPrice;

      const updatedPlan = await this.harvestPlanModel
        .findByIdAndUpdate(data.id, updateData, { new: true })
        .exec();

      if (!updatedPlan) {
        return {
          success: false,
          message: 'Harvest plan not found',
        };
      }

      return {
        success: true,
        message: 'Harvest plan updated successfully',
        data: this.formatPlanResponse(updatedPlan),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update harvest plan: ${error.message}`,
      };
    }
  }

  async DeletePlan(data: DeletePlanDto): Promise<DeletePlanResponseDto> {
    try {
      const deletedPlan = await this.harvestPlanModel.findByIdAndDelete(data.id).exec();

      if (!deletedPlan) {
        return {
          success: false,
          message: 'Harvest plan not found',
        };
      }

      return {
        success: true,
        message: 'Harvest plan deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete harvest plan: ${error.message}`,
      };
    }
  }

  async GetDemandPrice(data: GetDemandPriceDto): Promise<GetDemandPriceResponseDto> {
    try {
      // Parse start and end months
      const startDate = new Date(data.startMonth + '-01');
      const endDate = new Date(data.endMonth + '-01');
      endDate.setMonth(endDate.getMonth() + 1); // Include the end month

      // Fetch all distributor offers within the date range
      const offers = await this.distributorOfferModel
        .find({
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        })
        .exec();

      // Group by month and calculate aggregates
      const monthlyData = new Map<string, { totalDemand: number; totalPrice: number; count: number }>();

      for (const offer of offers) {
        const month = offer.createdAt
          ? `${offer.createdAt.getFullYear()}-${String(offer.createdAt.getMonth() + 1).padStart(2, '0')}`
          : null;

        if (!month) continue;

        if (!monthlyData.has(month)) {
          monthlyData.set(month, { totalDemand: 0, totalPrice: 0, count: 0 });
        }

        const monthData = monthlyData.get(month)!;
        monthData.totalDemand += offer.targetQuantity;
        monthData.totalPrice += offer.pricePerKilo;
        monthData.count += 1;
      }

      // Convert to response format and calculate averages
      const result = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          totalDemand: Math.round(data.totalDemand),
          pricePerBag: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        success: true,
        message: 'Demand and price data retrieved successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve demand and price data: ${error.message}`,
        data: [],
      };
    }
  }

  private formatPlanResponse(plan: any) {
    // Map Mongoose enum (string) to proto enum (number)
    const statusMap: Record<HarvestStatus, number> = {
      [HarvestStatus.FRESHER]: 0,
      [HarvestStatus.MIDLEVEL]: 1,
      [HarvestStatus.HARVESTED]: 2,
      [HarvestStatus.DISPOSED]: 3,
    };

    return {
      _id: plan._id.toString(),
      userId: plan.userId,
      saltBeds: plan.saltBeds,
      harvestStatus: statusMap[plan.harvestStatus as HarvestStatus] || 0,
      planPeriod: plan.planPeriod,
      startDate: plan.startDate.toISOString(),
      endDate: plan.endDate.toISOString(),
      predictedProduction: plan.predictedProduction,
      actualProduction: plan.actualProduction,
      workerCount: plan.workerCount,
      predictedProfit: plan.predictedProfit,
      actualProfit: plan.actualProfit,
      expenses: plan.expenses,
      earnings: plan.earnings,
      avgSellingPrice: plan.avgSellingPrice,
      createdAt: plan.createdAt?.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
    };
  }
}
