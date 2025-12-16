import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { DailyMeasurement } from './schemas/crystallization.schema';
import { DailyParameterPrediction } from './schemas/daily-parameter-prediction.schema';
import { MonthlyProductionPrediction } from './schemas/monthly-production-prediction.schema';
import type { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementByDateDto, GetDailyMeasurementByDateResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdDto, DeleteDailyMeasurementByIdResponseDto, GetPredictionsDto, GetPredictionsResponseDto } from './dtos/crystallization.dto';

interface CurrentValues {
  water_temperature: number;
  lagoon: number;
  OR_brine_level: number;
  OR_bund_level: number;
  IR_brine_level: number;
  IR_bound_level: number;
  East_channel: number;
  West_channel: number;
}

interface PredictionRequest {
  start_date: string;
  forecast_days: number;
  current_values: CurrentValues;
}

interface PredictionsMLService {
  GetPredictions(data: PredictionRequest): Observable<any>;
}

@Injectable()
export class CrystallizationService implements OnModuleInit {
  private predictionsMLService: PredictionsMLService;

  constructor(
    @InjectModel(DailyMeasurement.name) private dailyMeasurementModel: Model<DailyMeasurement>,
    @InjectModel(DailyParameterPrediction.name) private dailyParameterPredictionModel: Model<DailyParameterPrediction>,
    @InjectModel(MonthlyProductionPrediction.name) private monthlyProductionPredictionModel: Model<MonthlyProductionPrediction>,
    @Inject('PREDICTIONS_PACKAGE') private mlClient: ClientGrpc,
  ) { }

  onModuleInit() {
    this.predictionsMLService = this.mlClient.getService<PredictionsMLService>('PredictionsService');
  }

  async GetPredictions(data: GetPredictionsDto): Promise<GetPredictionsResponseDto> {
    try {
      console.log('GetPredictions called with data:', JSON.stringify(data, null, 2));
      const payload: PredictionRequest = {
        start_date: data.start_date,
        forecast_days: data.forecast_days,
        current_values: {
          water_temperature: data.current_values.water_temperature,
          lagoon: data.current_values.lagoon,
          OR_brine_level: data.current_values.OR_brine_level,
          OR_bund_level: data.current_values.OR_bund_level,
          IR_brine_level: data.current_values.IR_brine_level,
          IR_bound_level: data.current_values.IR_bound_level,
          East_channel: data.current_values.East_channel,
          West_channel: data.current_values.West_channel,
        },
      };

      console.log('Crystallization Service: Forwarding prediction request to ML service');
      const result = await firstValueFrom(
        this.predictionsMLService.GetPredictions(payload)
      );
      console.log('Crystallization Service: Received predictions from ML service');
      console.log('Response keys:', Object.keys(result));

      // Save daily parameter predictions to database
      console.log('Checking for daily_parameters_forecast...');
      console.log('daily_parameters_forecast keys:', result.daily_parameters_forecast ? Object.keys(result.daily_parameters_forecast) : 'N/A');
      
      const dailyForecast = result.daily_parameters_forecast?.forecasts;
      console.log('dailyForecast exists:', !!dailyForecast);
      console.log('dailyForecast is Array:', Array.isArray(dailyForecast));
      
      if (dailyForecast && Array.isArray(dailyForecast)) {
        console.log(`Saving ${dailyForecast.length} daily parameter predictions to database`);
        
        for (const dailyPrediction of dailyForecast) {
          try {
            await this.dailyParameterPredictionModel.findOneAndUpdate(
              { date: dailyPrediction.date }, // Filter by date
              {
                date: dailyPrediction.date,
                dayNumber: dailyPrediction.day_number,
                parameters: {
                  water_temperature: dailyPrediction.parameters.water_temperature,
                  lagoon: dailyPrediction.parameters.lagoon,
                  OR_brine_level: dailyPrediction.parameters.OR_brine_level,
                  OR_bund_level: dailyPrediction.parameters.OR_bund_level,
                  IR_brine_level: dailyPrediction.parameters.IR_brine_level,
                  IR_bound_level: dailyPrediction.parameters.IR_bound_level,
                  East_channel: dailyPrediction.parameters.East_channel,
                  West_channel: dailyPrediction.parameters.West_channel,
                },
                weather: {
                  temperature_mean: dailyPrediction.weather.temperature_mean,
                  temperature_min: dailyPrediction.weather.temperature_min,
                  temperature_max: dailyPrediction.weather.temperature_max,
                  rain_sum: dailyPrediction.weather.rain_sum,
                  wind_speed_max: dailyPrediction.weather.wind_speed_max,
                  wind_gusts_max: dailyPrediction.weather.wind_gusts_max,
                  relative_humidity_mean: dailyPrediction.weather.relative_humidity_mean,
                },
              },
              { upsert: true, new: true } // Create if not exists, return new document
            );
          } catch (error) {
            console.error(`Error saving daily prediction for date ${dailyPrediction.date}:`, error);
          }
        }
        
        console.log('Daily parameter predictions saved successfully');
      } else {
        console.log('Skipping daily predictions save - condition not met');
      }

      // Save monthly production predictions to database (using 12 months forecast)
      console.log('Checking for monthly_production_12months...');
      console.log('monthly_production_12months keys:', result.monthly_production_12months ? Object.keys(result.monthly_production_12months) : 'N/A');
      
      const monthlyForecast = result.monthly_production_12months?.forecasts;
      console.log('monthlyForecast exists:', !!monthlyForecast);
      console.log('monthlyForecast is Array:', Array.isArray(monthlyForecast));
      
      if (monthlyForecast && Array.isArray(monthlyForecast)) {
        console.log(`Saving ${monthlyForecast.length} monthly production predictions to database`);
        
        for (const monthlyPrediction of monthlyForecast) {
          try {
            await this.monthlyProductionPredictionModel.findOneAndUpdate(
              { month: monthlyPrediction.month }, // Filter by month
              {
                month: monthlyPrediction.month,
                monthNumber: monthlyPrediction.month_number,
                productionForecast: monthlyPrediction.production_forecast,
                lowerBound: monthlyPrediction.lower_bound,
                upperBound: monthlyPrediction.upper_bound,
                season: monthlyPrediction.season,
              },
              { upsert: true, new: true } // Create if not exists, return new document
            );
          } catch (error) {
            console.error(`Error saving monthly prediction for month ${monthlyPrediction.month}:`, error);
          }
        }
        
        console.log('Monthly production predictions saved successfully');
      } else {
        console.log('Skipping monthly predictions save - condition not met');
      }

      return result;
    } catch (error) {
      console.error('Error getting predictions from ML service:', error);
      throw new BadRequestException(`Failed to get predictions: ${error.message}`);
    }
  }

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

