import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActualMonthlyProduction } from './schemas/actual-monthly-production.schema';
import type {
  CreateActualMonthlyProductionDto,
  CreateActualMonthlyProductionResponseDto,
  UpdateActualMonthlyProductionDto,
  UpdateActualMonthlyProductionResponseDto,
  GetActualMonthlyProductionByRangeDto,
  GetActualMonthlyProductionByRangeResponseDto,
  GetActualMonthlyProductionByIdDto,
  GetActualMonthlyProductionByIdResponseDto,
  GetActualMonthlyProductionByMonthDto,
  GetActualMonthlyProductionByMonthResponseDto,
  DeleteActualMonthlyProductionDto,
  DeleteActualMonthlyProductionResponseDto,
} from './dtos/salt-production.dto';

@Injectable()
export class SaltProductionService {
  constructor(
    @InjectModel(ActualMonthlyProduction.name)
    private actualMonthlyProductionModel: Model<ActualMonthlyProduction>,
  ) {}

  async CreateActualMonthlyProduction(
    data: CreateActualMonthlyProductionDto
  ): Promise<CreateActualMonthlyProductionResponseDto> {
    try {
      console.log('Creating actual monthly production with data:', data);

      // Use upsert to update if month exists, create if not
      const result = await this.actualMonthlyProductionModel.findOneAndUpdate(
        { month: data.month },
        {
          month: data.month,
          production_volume: data.production_volume,
          season: data.season,
        },
        { upsert: true, new: true, runValidators: true }
      );

      const plainResult = result.toObject();

      return {
        success: true,
        message: 'Actual monthly production created/updated successfully',
        data: {
          _id: plainResult._id?.toString() || '',
          month: plainResult.month,
          production_volume: plainResult.production_volume,
          season: plainResult.season,
          createdAt: plainResult.createdAt?.toISOString() || '',
          updatedAt: plainResult.updatedAt?.toISOString() || '',
        },
      };
    } catch (error) {
      console.error('Error creating actual monthly production:', error);
      throw new BadRequestException(
        `Failed to create actual monthly production: ${error.message}`
      );
    }
  }

  async GetActualMonthlyProductionByRange(
    data: GetActualMonthlyProductionByRangeDto
  ): Promise<GetActualMonthlyProductionByRangeResponseDto> {
    try {
      console.log(
        'Getting actual monthly productions from',
        data.startMonth,
        'to',
        data.endMonth
      );

      const productions = await this.actualMonthlyProductionModel
        .find({
          month: {
            $gte: data.startMonth,
            $lte: data.endMonth,
          },
        })
        .sort({ month: 1 });

      if (!productions || productions.length === 0) {
        return {
          success: false,
          message: `No actual monthly productions found between ${data.startMonth} and ${data.endMonth}`,
          data: [],
        };
      }

      const result = productions.map((production) => {
        const plainProduction = production.toObject();
        return {
          _id: plainProduction._id?.toString() || '',
          month: plainProduction.month,
          production_volume: plainProduction.production_volume,
          season: plainProduction.season,
          createdAt: plainProduction.createdAt?.toISOString() || '',
          updatedAt: plainProduction.updatedAt?.toISOString() || '',
        };
      });

      console.log(`Found ${result.length} actual monthly productions`);

      return {
        success: true,
        message: 'Actual monthly productions fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching actual monthly productions:', error);
      throw new BadRequestException(
        `Failed to fetch actual monthly productions: ${error.message}`
      );
    }
  }

  async GetActualMonthlyProductionById(
    data: GetActualMonthlyProductionByIdDto
  ): Promise<GetActualMonthlyProductionByIdResponseDto> {
    try {
      console.log('Getting actual monthly production by ID:', data.id);

      const production = await this.actualMonthlyProductionModel.findById(
        data.id
      );

      if (!production) {
        return {
          success: false,
          message: `No actual monthly production found with ID: ${data.id}`,
          data: undefined,
        };
      }

      const plainProduction = production.toObject();

      return {
        success: true,
        message: 'Actual monthly production fetched successfully',
        data: {
          _id: plainProduction._id?.toString() || '',
          month: plainProduction.month,
          production_volume: plainProduction.production_volume,
          season: plainProduction.season,
          createdAt: plainProduction.createdAt?.toISOString() || '',
          updatedAt: plainProduction.updatedAt?.toISOString() || '',
        },
      };
    } catch (error) {
      console.error('Error fetching actual monthly production by ID:', error);
      throw new BadRequestException(
        `Failed to fetch actual monthly production: ${error.message}`
      );
    }
  }

  async GetActualMonthlyProductionByMonth(
    data: GetActualMonthlyProductionByMonthDto
  ): Promise<GetActualMonthlyProductionByMonthResponseDto> {
    try {
      console.log('Getting actual monthly production by month:', data.month);

      const production = await this.actualMonthlyProductionModel.findOne({
        month: data.month,
      });

      if (!production) {
        return {
          success: false,
          message: `No actual monthly production found for month: ${data.month}`,
          data: undefined,
        };
      }

      const plainProduction = production.toObject();

      return {
        success: true,
        message: 'Actual monthly production fetched successfully',
        data: {
          _id: plainProduction._id?.toString() || '',
          month: plainProduction.month,
          production_volume: plainProduction.production_volume,
          season: plainProduction.season,
          createdAt: plainProduction.createdAt?.toISOString() || '',
          updatedAt: plainProduction.updatedAt?.toISOString() || '',
        },
      };
    } catch (error) {
      console.error(
        'Error fetching actual monthly production by month:',
        error
      );
      throw new BadRequestException(
        `Failed to fetch actual monthly production: ${error.message}`
      );
    }
  }

  async UpdateActualMonthlyProduction(
    data: UpdateActualMonthlyProductionDto
  ): Promise<UpdateActualMonthlyProductionResponseDto> {
    try {
      console.log('Updating actual monthly production with ID:', data.id);

      const updateData: any = {};
      if (data.production_volume !== undefined) {
        updateData.production_volume = data.production_volume;
      }
      if (data.season !== undefined) {
        updateData.season = data.season;
      }

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          message: 'No valid fields provided to update',
          data: undefined,
        };
      }

      const production =
        await this.actualMonthlyProductionModel.findByIdAndUpdate(
          data.id,
          updateData,
          { new: true, runValidators: true }
        );

      if (!production) {
        return {
          success: false,
          message: `No actual monthly production found with ID: ${data.id}`,
          data: undefined,
        };
      }

      const plainProduction = production.toObject();

      return {
        success: true,
        message: 'Actual monthly production updated successfully',
        data: {
          _id: plainProduction._id?.toString() || '',
          month: plainProduction.month,
          production_volume: plainProduction.production_volume,
          season: plainProduction.season,
          createdAt: plainProduction.createdAt?.toISOString() || '',
          updatedAt: plainProduction.updatedAt?.toISOString() || '',
        },
      };
    } catch (error) {
      console.error('Error updating actual monthly production:', error);
      throw new BadRequestException(
        `Failed to update actual monthly production: ${error.message}`
      );
    }
  }

  async DeleteActualMonthlyProduction(
    data: DeleteActualMonthlyProductionDto
  ): Promise<DeleteActualMonthlyProductionResponseDto> {
    try {
      console.log('Deleting actual monthly production with ID:', data.id);

      const production =
        await this.actualMonthlyProductionModel.findByIdAndDelete(data.id);

      if (!production) {
        return {
          success: false,
          message: `No actual monthly production found with ID: ${data.id}`,
        };
      }

      console.log('Actual monthly production deleted successfully');

      return {
        success: true,
        message: 'Actual monthly production deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting actual monthly production:', error);
      throw new BadRequestException(
        `Failed to delete actual monthly production: ${error.message}`
      );
    }
  }
}
