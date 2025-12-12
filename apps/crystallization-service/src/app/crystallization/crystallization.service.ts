import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyMeasurement } from './schemas/crystallization.schema';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementByDateDto, GetDailyMeasurementByDateResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdDto, DeleteDailyMeasurementByIdResponseDto } from './dtos/crystallization.dto';

@Injectable()
export class CrystallizationService {
  constructor(@InjectModel(DailyMeasurement.name) private dailyMeasurementModel: Model<DailyMeasurement>) { }

  async CreateDailyMeasurement(data: CreateDailyMeasurementDto): Promise<CreateDailyMeasurementResponseDto> {
    try {
      console.log('Creating daily measurement with data:', data);
      const dailyMeasurement = await this.dailyMeasurementModel.create(data);

      if (!dailyMeasurement) {
        throw new NotFoundException('Daily Measurement not found');
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement created successfully',
        daily_measurement: {
          _id: result._id?.toString() || '',
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString().split('T')[0] || '',
          waterTemperature: result.waterTemperature || 0,
          lagoon: result.lagoon || 0,
          orBrineLevel: result.orBrineLevel || 0,
          orBoundLevel: result.orBoundLevel || 0,
          irBrineLevel: result.irBrineLevel || 0,
          irBoundLevel: result.irBoundLevel || 0,
          eastChannel: result.eastChannel || 0,
          westChannel: result.westChannel || 0,
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        },
      };

      console.log('=== SERVICE RETURNING ===');
      console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error creating daily measurement:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create daily measurement: ${error.message}`);
    }
  }

  async GetDailyMeasurementByDate(data: GetDailyMeasurementByDateDto): Promise<GetDailyMeasurementByDateResponseDto> {
    try {
      console.log('Getting daily measurement for date:', data.date);

      // Query the database for a measurement with the given date
      const dailyMeasurement = await this.dailyMeasurementModel.findOne({ date: data.date });

      if (!dailyMeasurement) {
        return {
          success: false,
          message: `No daily measurement found for date: ${data.date}`,
          daily_measurement: null,
        };
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement fetched successfully',
        daily_measurement: {
          _id: result._id?.toString() || '',
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString().split('T')[0] || '',
          waterTemperature: result.waterTemperature || 0,
          lagoon: result.lagoon || 0,
          orBrineLevel: result.orBrineLevel || 0,
          orBoundLevel: result.orBoundLevel || 0,
          irBrineLevel: result.irBrineLevel || 0,
          irBoundLevel: result.irBoundLevel || 0,
          eastChannel: result.eastChannel || 0,
          westChannel: result.westChannel || 0,
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        },
      };

      console.log('=== SERVICE RETURNING ===');
      console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error fetching daily measurement:', error);
      throw new BadRequestException(`Failed to fetch daily measurement: ${error.message}`);
    }
  }

  async UpdateDailyMeasurementById(data: UpdateDailyMeasurementByIdDto): Promise<UpdateDailyMeasurementByIdResponseDto> {
    try {
      console.log('Updating daily measurement with ID:', data.id);
      console.log('Update data:', data);

      // Prepare update object excluding the ID and any undefined/0 values
      // This ensures we only update fields that were actually provided
      const { id, ...allFields } = data;
      const updateData: Record<string, number> = {};

      // Only add fields that are defined and not 0 (to avoid overwriting with defaults)
      // Exception: allow 0 if it's explicitly set (we check for undefined instead)
      Object.keys(allFields).forEach(key => {
        const value = (allFields as Record<string, number>)[key];
        // Only include the field if it's defined and not the default proto value (0)
        // For fields that legitimately can be 0, we need to distinguish between
        // "not provided" vs "set to 0". Since proto3 defaults numbers to 0,
        // we treat 0 as "not provided" to preserve existing values
        if (value !== undefined && value !== 0) {
          updateData[key] = value;
        }
      });

      console.log('Filtered update data (excluding undefined and 0):', updateData);

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          message: 'No valid fields provided to update',
          daily_measurement: null,
        };
      }

      // Update the measurement by ID
      const dailyMeasurement = await this.dailyMeasurementModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true } // Return updated document and run validators
      );

      if (!dailyMeasurement) {
        return {
          success: false,
          message: `No daily measurement found with ID: ${id}`,
          daily_measurement: null,
        };
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement updated successfully',
        daily_measurement: {
          _id: result._id?.toString() || '',
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString().split('T')[0] || '',
          waterTemperature: result.waterTemperature || 0,
          lagoon: result.lagoon || 0,
          orBrineLevel: result.orBrineLevel || 0,
          orBoundLevel: result.orBoundLevel || 0,
          irBrineLevel: result.irBrineLevel || 0,
          irBoundLevel: result.irBoundLevel || 0,
          eastChannel: result.eastChannel || 0,
          westChannel: result.westChannel || 0,
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        },
      };

      console.log('=== SERVICE RETURNING ===');
      console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error updating daily measurement:', error);
      throw new BadRequestException(`Failed to update daily measurement: ${error.message}`);
    }
  }

  async DeleteDailyMeasurementById(data: DeleteDailyMeasurementByIdDto): Promise<DeleteDailyMeasurementByIdResponseDto> {
    try {
      console.log('Deleting daily measurement with ID:', data.id);

      // Delete the measurement by ID
      const dailyMeasurement = await this.dailyMeasurementModel.findByIdAndDelete(data.id);

      if (!dailyMeasurement) {
        return {
          success: false,
          message: `No daily measurement found with ID: ${data.id}`,
        };
      }

      console.log('Daily measurement deleted successfully');

      return {
        success: true,
        message: 'Daily Measurement deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting daily measurement:', error);
      throw new BadRequestException(`Failed to delete daily measurement: ${error.message}`);
    }
  }
}

