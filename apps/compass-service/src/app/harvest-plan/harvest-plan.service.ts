import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HarvestPlan, HarvestStatus } from './schemas/harvest-plan.schema';
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
} from './dtos/harvest-plan.dto';

@Injectable()
export class HarvestPlanService {
  constructor(
    @InjectModel(HarvestPlan.name)
    private harvestPlanModel: Model<HarvestPlan>
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
      const filter = data.userId ? { userId: data.userId } : {};
      const plans = await this.harvestPlanModel.find(filter).exec();

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
        };
        updateData.harvestStatus = harvestStatusMap[data.harvestStatus];
      }
      if (data.planPeriod !== undefined) updateData.planPeriod = data.planPeriod;
      if (data.startDate !== undefined) {
        updateData.startDate = new Date(data.startDate);
        // Recalculate end date if start date or plan period changes
        const plan = await this.harvestPlanModel.findById(data.id);
        if (plan) {
          const endDate = new Date(updateData.startDate);
          endDate.setDate(endDate.getDate() + (data.planPeriod || plan.planPeriod));
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

  private formatPlanResponse(plan: any) {
    // Map Mongoose enum (string) to proto enum (number)
    const statusMap: Record<HarvestStatus, number> = {
      [HarvestStatus.FRESHER]: 0,
      [HarvestStatus.MIDLEVEL]: 1,
      [HarvestStatus.HARVESTED]: 2,
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
