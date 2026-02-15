import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ClientGrpc, ClientKafka } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DailyMeasurement } from './schemas/crystallization.schema';
import { DailyParameterPrediction } from './schemas/daily-parameter-prediction.schema';
import { MonthlyProductionPrediction } from './schemas/monthly-production-prediction.schema';
import { CrystallizationModelPerformance } from './schemas/crystallization-model-performance.schema';
import type { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementByDateDto, GetDailyMeasurementByDateResponseDto, GetDailyMeasurementsByDateRangeDto, GetDailyMeasurementsByDateRangeResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdDto, DeleteDailyMeasurementByIdResponseDto, GetPredictionsDto, GetPredictionsResponseDto, GetPredictedDailyMeasurementDto, GetPredictedDailyMeasurementResponseDto, GetPredictedMonthlyProductionDto, GetPredictedMonthlyProductionResponseDto, GetModelPerformanceDto, GetModelPerformanceResponseDto } from './dtos/crystallization.dto';

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

interface PredictionsONNXService {
  GetPredictions(data: PredictionRequest): Observable<any>;
}

@Injectable()
export class CrystallizationService implements OnModuleInit {
  private predictionsONNXService: PredictionsONNXService;

  constructor(
    @InjectModel(DailyMeasurement.name) private dailyMeasurementModel: Model<DailyMeasurement>,
    @InjectModel(DailyParameterPrediction.name) private dailyParameterPredictionModel: Model<DailyParameterPrediction>,
    @InjectModel(MonthlyProductionPrediction.name) private monthlyProductionPredictionModel: Model<MonthlyProductionPrediction>,
    @InjectModel(CrystallizationModelPerformance.name) private crystallizationModelPerformanceModel: Model<CrystallizationModelPerformance>,
    @Inject('PREDICTIONS_PACKAGE') private onnxClient: ClientGrpc,
    @Inject('AUDIT_LOG_SERVICE') private auditLogClient: ClientKafka,
    private configService: ConfigService,
  ) { }

  async onModuleInit() {
    this.predictionsONNXService = this.onnxClient.getService<PredictionsONNXService>('PredictionsService');
    await this.auditLogClient.connect();
  }

  /**
   * Helper method to emit audit logs via Kafka
   */
  private async emitAuditLog(data: {
    serviceName: string;
    action: string;
    userId?: string;
    resourceId?: string;
    resourceType: string;
    details?: string;
    status: 'success' | 'error';
    method?: string;
    path?: string;
  }): Promise<void> {
    try {
      this.auditLogClient.emit('create_audit_log', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to emit audit log:', error);
    }
  }

  /**
   * Fetches current weather data from OpenWeatherMap API
   * @returns Weather object or null if fetch fails
   */
  private async fetchWeatherData(): Promise<any | null> {
    try {
      const apiKey = this.configService.get<string>('OPENWEATHER_API_KEY');
      const lat = this.configService.get<string>('OPENWEATHER_LAT');
      const lon = this.configService.get<string>('OPENWEATHER_LON');

      if (!apiKey || !lat || !lon) {
        console.warn('OpenWeatherMap API credentials not configured. Skipping weather data fetch.');
        return null;
      }

      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      console.log('Fetching weather data from OpenWeatherMap API...');

      const response = await axios.get(url);

      if (response.data && response.data.main) {
        // Convert temperatures from Kelvin to Celsius
        const tempCelsius = response.data.main.temp - 273.15;
        const tempMinCelsius = response.data.main.temp_min - 273.15;
        const tempMaxCelsius = response.data.main.temp_max - 273.15;

        const weatherData = {
          temperature_mean: Math.round(tempCelsius * 100) / 100,
          temperature_max: Math.round(tempMaxCelsius * 100) / 100,
          temperature_min: Math.round(tempMinCelsius * 100) / 100,
          rain_sum: response.data.rain?.['1h'] || 0,
          wind_speed_max: response.data.wind?.speed || 0,
          wind_gusts_max: response.data.wind?.gust || 0,
          relative_humidity_mean: response.data.main.humidity || 0,
        };

        console.log(`Weather data fetched successfully:`, weatherData);
        return weatherData;
      }

      console.warn('Weather data response missing required fields');
      return null;
    } catch (error) {
      console.error('Error fetching weather data from OpenWeatherMap:', error.message);
      return null;
    }
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

      console.log('Crystallization Service: Forwarding prediction request to ONNX service');
      const result = await firstValueFrom(
        this.predictionsONNXService.GetPredictions(payload)
      );
      console.log('Crystallization Service: Received predictions from ONNX service');
      console.log('Response keys:', Object.keys(result));

      // Save model performance metrics to database
      if (result.model_info && result.model_info.performance_metrics) {
        try {
          console.log('Saving model performance metrics to database...');

          const performanceData = {
            model_type: result.model_info.model_type,
            forecast_generated: new Date(result.model_info.forecast_generated),
            performance_metrics: {
              test_mae: result.model_info.performance_metrics.test_mae,
              test_rmse: result.model_info.performance_metrics.test_rmse,
              test_r2_score: result.model_info.performance_metrics.test_r2_score,
              test_accuracy: result.model_info.performance_metrics.test_accuracy,
              validation_r2_score: result.model_info.performance_metrics.validation_r2_score,
              validation_accuracy: result.model_info.performance_metrics.validation_accuracy,
            },
          };

          await this.crystallizationModelPerformanceModel.create(performanceData);
          console.log('Model performance metrics saved successfully');
        } catch (error) {
          console.error('Error saving model performance metrics:', error);
          // Don't throw error - we still want to return predictions even if performance save fails
        }
      } else {
        console.log('No model_info found in response, skipping performance metrics save');
      }


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
                metadata: {
                  water_temperature: data.current_values.water_temperature,
                  lagoon: data.current_values.lagoon,
                  OR_brine_level: data.current_values.OR_brine_level,
                  OR_bund_level: data.current_values.OR_bund_level,
                  IR_brine_level: data.current_values.IR_brine_level,
                  IR_bound_level: data.current_values.IR_bound_level,
                  East_channel: data.current_values.East_channel,
                  West_channel: data.current_values.West_channel,
                }
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

  async CreateDailyMeasurement(data: CreateDailyMeasurementDto | any): Promise<CreateDailyMeasurementResponseDto> {
    try {
      console.log('Creating daily measurement with data:', data);

      // Fetch weather data from OpenWeatherMap API
      const weatherData = await this.fetchWeatherData();

      // Check if data is in old format (flat structure) or new format (nested)
      let measurementData;

      if (data.parameters && data.weather) {
        // New format - use as is
        measurementData = {
          date: data.date,
          dayNumber: data.dayNumber,
          parameters: data.parameters,
          weather: weatherData !== null ? weatherData : data.weather,
        };
      } else {
        // Old format - transform to new structure
        // Calculate dayNumber from date (days since epoch start date)
        const epochStart = new Date('2023-01-01');
        const currentDate = new Date(data.date);
        const dayNumber = Math.floor((currentDate.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        measurementData = {
          date: data.date,
          dayNumber: dayNumber,
          parameters: {
            water_temperature: data.waterTemperature || 0,
            lagoon: data.lagoon || 0,
            OR_brine_level: data.orBrineLevel || 0,
            OR_bund_level: data.orBoundLevel || 0,
            IR_brine_level: data.irBrineLevel || 0,
            IR_bound_level: data.irBoundLevel || 0,
            East_channel: data.eastChannel || 0,
            West_channel: data.westChannel || 0,
          },
          weather: weatherData !== null ? weatherData : {
            temperature_mean: data.waterTemperature || 0,
            temperature_max: data.waterTemperature || 0,
            temperature_min: data.waterTemperature || 0,
            rain_sum: 0,
            wind_speed_max: 0,
            wind_gusts_max: 0,
            relative_humidity_mean: 0,
          },
        };
      }

      console.log('Creating measurement with weather data:', measurementData.weather);
      const dailyMeasurement = await this.dailyMeasurementModel.create(measurementData);

      if (!dailyMeasurement) {
        throw new NotFoundException('Daily Measurement not found');
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement created successfully',
        data: {
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString() || '',
          dayNumber: result.dayNumber,
          parameters: result.parameters,
          weather: result.weather,
          _id: result._id?.toString() || '',
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        },
      };

      // Audit log for daily measurement creation
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_CREATED',
        resourceId: result._id?.toString(),
        resourceType: 'daily_measurement',
        details: JSON.stringify({ date: data.date }),
        status: 'success',
        method: 'POST',
        path: '/crystallization/daily-measurements',
      });

      console.log('=== SERVICE RETURNING ===');
      console.log(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error creating daily measurement:', error);
      
      // Audit log for failed daily measurement creation
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_CREATION_FAILED',
        resourceType: 'daily_measurement',
        details: JSON.stringify({ date: data?.date, error: error.message }),
        status: 'error',
        method: 'POST',
        path: '/crystallization/daily-measurements',
      });

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
          data: null,
        };
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement fetched successfully',
        data: {
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString() || '',
          dayNumber: result.dayNumber,
          parameters: result.parameters,
          weather: result.weather,
          _id: result._id?.toString() || '',
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

  async GetDailyMeasurementsByDateRange(data: GetDailyMeasurementsByDateRangeDto): Promise<GetDailyMeasurementsByDateRangeResponseDto> {
    try {
      console.log('Getting daily measurements for date range:', data.startDate, 'to', data.endDate);

      // Query the database for measurements within the date range
      const dailyMeasurements = await this.dailyMeasurementModel.find({
        date: {
          $gte: new Date(data.startDate),
          $lte: new Date(data.endDate),
        },
      }).sort({ date: 1 }); // Sort by date ascending

      if (!dailyMeasurements || dailyMeasurements.length === 0) {
        return {
          success: true,
          message: `No daily measurements found for date range: ${data.startDate} to ${data.endDate}`,
          data: [],
        };
      }

      // Convert to plain objects and map to response format
      const measurements = dailyMeasurements.map(measurement => {
        const result = measurement.toObject();
        return {
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString() || '',
          dayNumber: result.dayNumber,
          parameters: result.parameters,
          weather: result.weather,
          _id: result._id?.toString() || '',
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        };
      });

      const response = {
        success: true,
        message: `Found ${measurements.length} daily measurements`,
        data: measurements,
      };

      console.log('=== SERVICE RETURNING ===');
      console.log(`Returning ${measurements.length} measurements`);

      return response;
    } catch (error) {
      console.error('Error fetching daily measurements by date range:', error);
      throw new BadRequestException(`Failed to fetch daily measurements: ${error.message}`);
    }
  }

  async UpdateDailyMeasurementById(data: UpdateDailyMeasurementByIdDto): Promise<UpdateDailyMeasurementByIdResponseDto> {
    try {
      console.log('Updating daily measurement with ID:', data.id);
      console.log('Update data:', data);

      // Prepare update object - transform old flat structure to new nested structure
      const { id, ...allFields } = data;

      // Build the nested parameters object from flat fields
      const parametersUpdate: any = {};
      if (allFields.waterTemperature !== undefined && allFields.waterTemperature !== 0) {
        parametersUpdate.water_temperature = allFields.waterTemperature;
      }
      if (allFields.lagoon !== undefined && allFields.lagoon !== 0) {
        parametersUpdate.lagoon = allFields.lagoon;
      }
      if (allFields.orBrineLevel !== undefined && allFields.orBrineLevel !== 0) {
        parametersUpdate.OR_brine_level = allFields.orBrineLevel;
      }
      if (allFields.orBoundLevel !== undefined && allFields.orBoundLevel !== 0) {
        parametersUpdate.OR_bund_level = allFields.orBoundLevel;
      }
      if (allFields.irBrineLevel !== undefined && allFields.irBrineLevel !== 0) {
        parametersUpdate.IR_brine_level = allFields.irBrineLevel;
      }
      if (allFields.irBoundLevel !== undefined && allFields.irBoundLevel !== 0) {
        parametersUpdate.IR_bound_level = allFields.irBoundLevel;
      }
      if (allFields.eastChannel !== undefined && allFields.eastChannel !== 0) {
        parametersUpdate.East_channel = allFields.eastChannel;
      }
      if (allFields.westChannel !== undefined && allFields.westChannel !== 0) {
        parametersUpdate.West_channel = allFields.westChannel;
      }

      console.log('Parameters update:', parametersUpdate);

      // Check if there's anything to update
      if (Object.keys(parametersUpdate).length === 0) {
        return {
          success: false,
          message: 'No valid fields provided to update',
          data: null,
        };
      }

      // Update the measurement by ID using dot notation for nested fields
      const updateData: any = {};
      Object.keys(parametersUpdate).forEach(key => {
        updateData[`parameters.${key}`] = parametersUpdate[key];
      });

      const dailyMeasurement = await this.dailyMeasurementModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true } // Return updated document and run validators
      );

      if (!dailyMeasurement) {
        return {
          success: false,
          message: `No daily measurement found with ID: ${id}`,
          data: null,
        };
      }

      // Convert to plain object and return all fields
      const result = dailyMeasurement.toObject();

      const response = {
        success: true,
        message: 'Daily Measurement updated successfully',
        data: {
          date: typeof result.date === 'string' ? result.date : result.date?.toISOString() || '',
          dayNumber: result.dayNumber,
          parameters: result.parameters,
          weather: result.weather,
          _id: result._id?.toString() || '',
          createdAt: result.createdAt?.toISOString() || '',
          updatedAt: result.updatedAt?.toISOString() || '',
        },
      };

      console.log('=== SERVICE RETURNING ===');
      console.log(JSON.stringify(response, null, 2));

      // Audit log for daily measurement update
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_UPDATED',
        resourceId: id,
        resourceType: 'daily_measurement',
        details: JSON.stringify({ updatedFields: Object.keys(parametersUpdate) }),
        status: 'success',
        method: 'PUT',
        path: '/crystallization/daily-measurements',
      });

      return response;
    } catch (error) {
      console.error('Error updating daily measurement:', error);
      
      // Audit log for failed daily measurement update
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_UPDATE_FAILED',
        resourceId: data.id,
        resourceType: 'daily_measurement',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'PUT',
        path: '/crystallization/daily-measurements',
      });

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

      // Audit log for daily measurement deletion
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_DELETED',
        resourceId: data.id,
        resourceType: 'daily_measurement',
        details: JSON.stringify({ date: dailyMeasurement.date }),
        status: 'success',
        method: 'DELETE',
        path: '/crystallization/daily-measurements',
      });

      return {
        success: true,
        message: 'Daily Measurement deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting daily measurement:', error);
      
      // Audit log for failed daily measurement deletion
      await this.emitAuditLog({
        serviceName: 'crystallization-service',
        action: 'DAILY_MEASUREMENT_DELETION_FAILED',
        resourceId: data.id,
        resourceType: 'daily_measurement',
        details: JSON.stringify({ error: error.message }),
        status: 'error',
        method: 'DELETE',
        path: '/crystallization/daily-measurements',
      });

      throw new BadRequestException(`Failed to delete daily measurement: ${error.message}`);
    }
  }

  async GetPredictedDailyMeasurement(data: GetPredictedDailyMeasurementDto): Promise<GetPredictedDailyMeasurementResponseDto> {
    try {
      console.log('Getting predicted daily measurements from', data.startDate, 'to', data.endDate);

      // Query the database for predictions between the dates (inclusive)
      const predictions = await this.dailyParameterPredictionModel.find({
        date: {
          $gte: data.startDate,
          $lte: data.endDate,
        },
      }).sort({ date: 1 }); // Sort by date ascending

      if (!predictions || predictions.length === 0) {
        return {
          success: false,
          message: `No predicted daily measurements found between ${data.startDate} and ${data.endDate}`,
          data: [],
        };
      }

      // Convert to plain objects
      const result = predictions.map((prediction) => prediction.toObject());

      console.log(`Found ${result.length} predicted daily measurements`);

      return {
        success: true,
        message: 'Predicted daily measurements fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching predicted daily measurements:', error);
      throw new BadRequestException(`Failed to fetch predicted daily measurements: ${error.message}`);
    }
  }

  async GetPredictedMonthlyProduction(data: GetPredictedMonthlyProductionDto): Promise<GetPredictedMonthlyProductionResponseDto> {
    try {
      console.log('Getting predicted monthly productions from', data.startMonth, 'to', data.endMonth);

      // Query the database for predictions between the months (inclusive)
      const predictions = await this.monthlyProductionPredictionModel.find({
        month: {
          $gte: data.startMonth,
          $lte: data.endMonth,
        },
      }).sort({ month: 1 }); // Sort by month ascending

      if (!predictions || predictions.length === 0) {
        return {
          success: false,
          message: `No predicted monthly productions found between ${data.startMonth} and ${data.endMonth}`,
          data: [],
        };
      }

      // Convert to plain objects
      const result = predictions.map((prediction) => prediction.toObject());

      console.log(`Found ${result.length} predicted monthly productions`);

      return {
        success: true,
        message: 'Predicted monthly productions fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching predicted monthly productions:', error);
      throw new BadRequestException(`Failed to fetch predicted monthly productions: ${error.message}`);
    }
  }

  async GetModelPerformance(data: GetModelPerformanceDto): Promise<GetModelPerformanceResponseDto> {
    try {
      const limit = data.limit && data.limit > 0 && data.limit <= 100 ? data.limit : 10;

      console.log(`Getting model performance records with limit: ${limit}`);

      // Query the database for model performance records, sorted by most recent first
      const performanceRecords = await this.crystallizationModelPerformanceModel
        .find()
        .sort({ createdAt: -1 })
        .limit(limit);

      if (!performanceRecords || performanceRecords.length === 0) {
        return {
          success: true,
          message: 'No model performance records found',
          data: [],
        };
      }

      // Convert to plain objects
      const result = performanceRecords.map((record) => record.toObject());

      console.log(`Found ${result.length} model performance records`);

      return {
        success: true,
        message: 'Model performance records fetched successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error fetching model performance records:', error);
      throw new BadRequestException(`Failed to fetch model performance records: ${error.message}`);
    }
  }
}

