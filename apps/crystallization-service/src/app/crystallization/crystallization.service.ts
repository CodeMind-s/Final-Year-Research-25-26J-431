import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyMeasurement } from './schemas/crystallization.schema';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto } from './dtos/crystallization.dto';

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
}
