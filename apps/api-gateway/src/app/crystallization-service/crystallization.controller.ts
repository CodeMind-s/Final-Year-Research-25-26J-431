import { Controller, Inject, Post, Body, Get, Patch, Param, Delete, Query, Logger, HttpStatus, HttpException, Req } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { RequirePlan } from '../auth/decorators/plan.decorator';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdResponseDto } from './dtos/dailyMeasurement.dto';
import { PredictionRequestDto } from './dtos/prediction-request.dto';
import { GetPredictedDailyMeasurementResponseDto } from './dtos/predicted-daily-measurement.dto';
import { GetPredictedMonthlyProductionResponseDto } from './dtos/predicted-monthly-production.dto';
import { GetWeatherForecastResponseDto } from './dtos/weather-forecast.dto';
import { GetModelPerformanceResponseDto } from './dtos/model-performance.dto';

@ApiTags('Crystallization Predictions')
@Controller('crystallization')
export class CrystallizationController {
  private crystallizationService: any;
  private readonly logger = new Logger(CrystallizationController.name);

  constructor(@Inject('CRYSTALLIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.crystallizationService = this.client.getService('CrystallizationService');
  }

  @Post("/daily-measurement")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Daily Measurement (saltsociety)' })
  @ApiBody({ type: CreateDailyMeasurementDto })
  @ApiResponse({ status: 201, description: 'Daily measurement created successfully', type: CreateDailyMeasurementResponseDto })
  @ApiResponse({ status: 404, description: 'Daily measurement not created' })
  async createDailyMeasurement(@Body() body: CreateDailyMeasurementDto): Promise<CreateDailyMeasurementResponseDto> {
    try {
      // Ensure all numeric fields are properly set (not undefined)
      const requestData = {
        date: body.date,
        waterTemperature: body.waterTemperature ?? 0,
        lagoon: body.lagoon,
        orBrineLevel: body.orBrineLevel ?? 0,
        orBoundLevel: body.orBoundLevel ?? 0,
        irBrineLevel: body.irBrineLevel ?? 0,
        irBoundLevel: body.irBoundLevel ?? 0,
        eastChannel: body.eastChannel ?? 0,
        westChannel: body.westChannel ?? 0,
      };

      const result = await firstValueFrom(
        this.crystallizationService.CreateDailyMeasurement(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Daily Measurement error: ${error.message}`);
            throw new HttpException('Failed to create daily measurement', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));
      this.logger.log('Result keys:', Object.keys(result));
      this.logger.log('data:', result.data);

      // Return the data directly from the gRPC response
      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("daily-measurement/:date")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Daily Measurement by Date (saltsociety)' })
  @ApiParam({ name: 'date', type: String, description: 'Date in YYYY-MM-DD format', example: '2025-12-12' })
  @ApiResponse({ status: 200, description: 'Daily measurement fetched successfully', type: GetDailyMeasurementResponseDto })
  @ApiResponse({ status: 404, description: 'Daily measurement not found' })
  async getDailyMeasurementByDate(@Param('date') date: string): Promise<GetDailyMeasurementResponseDto> {
    try {
      if (!date) {
        throw new HttpException('Date parameter is required', HttpStatus.BAD_REQUEST);
      }

      const requestData = {
        date: date,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetDailyMeasurementByDate(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Daily Measurement error: ${error.message}`);
            throw new HttpException('Failed to fetch daily measurement', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      // Return the data directly from the gRPC response
      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("daily-measurement")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Daily Measurements by Date Range (saltsociety)' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date in YYYY-MM-DD format', example: '2025-12-01' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date in YYYY-MM-DD format', example: '2025-12-29' })
  @ApiResponse({ status: 200, description: 'Daily measurements fetched successfully' })
  @ApiResponse({ status: 404, description: 'No daily measurements found' })
  async getDailyMeasurementsByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    try {
      if (!startDate || !endDate) {
        throw new HttpException('Both startDate and endDate parameters are required', HttpStatus.BAD_REQUEST);
      }

      const requestData = {
        startDate: startDate,
        endDate: endDate,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetDailyMeasurementsByDateRange(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Daily Measurements by Date Range error: ${error.message}`);
            throw new HttpException('Failed to fetch daily measurements', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(`Fetched ${result.data?.length || 0} measurements`);

      // Return the data directly from the gRPC response
      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch("daily-measurement/:id")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Daily Measurement by ID (saltsociety)' })
  @ApiParam({ name: 'id', type: String, description: 'Measurement ID', example: '675945c5d1234567890abcde' })
  @ApiBody({ type: UpdateDailyMeasurementByIdDto })
  @ApiResponse({ status: 200, description: 'Daily measurement updated successfully', type: UpdateDailyMeasurementByIdResponseDto })
  @ApiResponse({ status: 404, description: 'Daily measurement not found' })
  async updateDailyMeasurementById(
    @Param('id') id: string,
    @Body() body: UpdateDailyMeasurementByIdDto
  ): Promise<UpdateDailyMeasurementByIdResponseDto> {
    try {
      // Only include fields that are actually provided in the request
      // This ensures we don't overwrite existing values with undefined/0
      const requestData: any = {
        id: id,
      };

      // Add only defined fields to the request
      if (body.waterTemperature !== undefined) requestData.waterTemperature = body.waterTemperature;
      if (body.lagoon !== undefined) requestData.lagoon = body.lagoon;
      if (body.orBrineLevel !== undefined) requestData.orBrineLevel = body.orBrineLevel;
      if (body.orBoundLevel !== undefined) requestData.orBoundLevel = body.orBoundLevel;
      if (body.irBrineLevel !== undefined) requestData.irBrineLevel = body.irBrineLevel;
      if (body.irBoundLevel !== undefined) requestData.irBoundLevel = body.irBoundLevel;
      if (body.eastChannel !== undefined) requestData.eastChannel = body.eastChannel;
      if (body.westChannel !== undefined) requestData.westChannel = body.westChannel;

      const result = await firstValueFrom(
        this.crystallizationService.UpdateDailyMeasurementById(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Update Daily Measurement error: ${error.message}`);
            throw new HttpException('Failed to update daily measurement', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      // Return the data directly from the gRPC response
      return {
        success: result.success,
        message: result.message,
        data: result.data || null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete("daily-measurement/:id")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Daily Measurement by ID (saltsociety)' })
  @ApiParam({ name: 'id', type: String, description: 'Measurement ID', example: '675945c5d1234567890abcde' })
  @ApiResponse({ status: 200, description: 'Daily measurement deleted successfully', type: DeleteDailyMeasurementByIdResponseDto })
  @ApiResponse({ status: 404, description: 'Daily measurement not found' })
  async deleteDailyMeasurementById(@Param('id') id: string): Promise<DeleteDailyMeasurementByIdResponseDto> {
    try {
      const requestData = {
        id: id,
      };

      const result = await firstValueFrom(
        this.crystallizationService.DeleteDailyMeasurementById(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Delete Daily Measurement error: ${error.message}`);
            throw new HttpException('Failed to delete daily measurement', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Post("/predictions")
  @Roles(Role.SALTSOCIETY, Role.LANDOWNER)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ML predictions for crystallization parameters (saltsociety & landowner)' })
  @ApiBody({ type: PredictionRequestDto })
  @ApiResponse({ status: 200, description: 'Predictions generated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPredictions(@Body() predictionRequest: PredictionRequestDto, @Req() req: any) {
    try {
      // Validate start_date is not in the past
      const startDate = new Date(predictionRequest.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
      
      if (startDate < today) {
        throw new HttpException(
          {
            status: 'error',
            message: `Start date cannot be in the past. Please provide today's date or a future date.`,
            providedDate: predictionRequest.start_date,
            todayDate: today.toISOString().split('T')[0],
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Extract role and userId from JWT token (more secure than request body)
      const role = req.user?.role?.toUpperCase() || 'SALTSOCIETY';
      const landownerId = req.user?.userId || null;

      this.logger.log(`Prediction request from user: ${landownerId}, role: ${role}`);

      const payload = {
        start_date: predictionRequest.start_date,
        forecast_days: predictionRequest.forecast_days,
        num_salt_beds: predictionRequest.num_salt_beds || 7500,
        latitude: predictionRequest.latitude,
        longitude: predictionRequest.longitude,
        role: role,
        landowner_id: landownerId,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetPredictions(payload)
      );

      return result;
    } catch (error: any) {
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Failed to get predictions',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("/predicted-daily-measurement")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get predicted daily measurements by date range (saltsociety)' })
  @ApiQuery({ name: 'startDate', type: String, description: 'Start date in YYYY-MM-DD format', example: '2025-12-01' })
  @ApiQuery({ name: 'endDate', type: String, description: 'End date in YYYY-MM-DD format', example: '2025-12-31' })
  @ApiResponse({ status: 200, description: 'Predicted daily measurements fetched successfully', type: GetPredictedDailyMeasurementResponseDto })
  @ApiResponse({ status: 404, description: 'No predicted daily measurements found' })
  async getPredictedDailyMeasurement(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<GetPredictedDailyMeasurementResponseDto> {
    try {
      if (!startDate || !endDate) {
        throw new HttpException('Both startDate and endDate parameters are required', HttpStatus.BAD_REQUEST);
      }

      const requestData = {
        startDate: startDate,
        endDate: endDate,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetPredictedDailyMeasurement(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Predicted Daily Measurement error: ${error.message}`);
            throw new HttpException('Failed to fetch predicted daily measurements', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("/predicted-monthly-productions")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(1)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get predicted monthly productions by month range (saltsociety)' })
  @ApiQuery({ name: 'startMonth', type: String, description: 'Start month in YYYY-MM format', example: '2025-06' })
  @ApiQuery({ name: 'endMonth', type: String, description: 'End month in YYYY-MM format', example: '2025-12' })
  @ApiResponse({ status: 200, description: 'Predicted monthly productions fetched successfully', type: GetPredictedMonthlyProductionResponseDto })
  @ApiResponse({ status: 404, description: 'No predicted monthly productions found' })
  async getPredictedMonthlyProduction(
    @Query('startMonth') startMonth: string,
    @Query('endMonth') endMonth: string
  ): Promise<GetPredictedMonthlyProductionResponseDto> {
    try {
      if (!startMonth || !endMonth) {
        throw new HttpException('Both startMonth and endMonth parameters are required', HttpStatus.BAD_REQUEST);
      }

      const requestData = {
        startMonth: startMonth,
        endMonth: endMonth,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetPredictedMonthlyProduction(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Predicted Monthly Production error: ${error.message}`);
            throw new HttpException('Failed to fetch predicted monthly productions', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("/weather-forecast")
  @Roles(Role.SALTSOCIETY, Role.LANDOWNER)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiTags('Crystallization Weather')
  @ApiOperation({ summary: 'Get daily weather forecast. Defaults to Puttalam salt production area (lat=8.061542, lon=79.814714, cnt=16).' })
  @ApiQuery({ name: 'lat', type: Number, required: false, description: 'Latitude', example: 8.061542 })
  @ApiQuery({ name: 'lon', type: Number, required: false, description: 'Longitude', example: 79.814714 })
  @ApiQuery({ name: 'cnt', type: Number, required: false, description: 'Number of forecast days (max 16)', example: 16 })
  @ApiResponse({ status: 200, description: 'Weather forecast fetched successfully', type: GetWeatherForecastResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch weather forecast' })
  async getWeatherForecast(
    @Query('lat') lat?: number,
    @Query('lon') lon?: number,
    @Query('cnt') cnt?: number,
  ): Promise<GetWeatherForecastResponseDto> {
    try {
      const requestData = {
        lat: lat ? parseFloat(lat.toString()) : 8.061542,
        lon: lon ? parseFloat(lon.toString()) : 79.814714,
        cnt: cnt ? parseInt(cnt.toString(), 10) : 16,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetWeatherForecast(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Weather Forecast error: ${error.message}`);
            throw new HttpException('Failed to fetch weather forecast', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data: string };

      this.logger.log('=== GRPC RESULT (weather forecast) ===');
      this.logger.log(`success: ${result.success}, message: ${result.message}`);

      return {
        success: result.success,
        message: result.message,
        data: result.data ? JSON.parse(result.data) : null,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("/model-performance")
  @Roles(Role.SALTSOCIETY)
  @RequirePlan(0, 1)
  @ApiBearerAuth()
  @ApiTags('Crystallization Model Performance')
  @ApiOperation({ summary: 'Get model performance and confidence metrics (saltsociety)' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Number of records to retrieve (max 100)', example: 10 })
  @ApiResponse({ status: 200, description: 'Model performance records fetched successfully', type: GetModelPerformanceResponseDto })
  @ApiResponse({ status: 400, description: 'Failed to fetch model performance' })
  async getModelPerformance(@Query('limit') limit?: number): Promise<GetModelPerformanceResponseDto> {
    try {
      const requestData = {
        limit: limit ? parseInt(limit.toString(), 10) : 10,
      };

      const result = await firstValueFrom(
        this.crystallizationService.GetModelPerformance(requestData).pipe(
          catchError((error) => {
            this.logger.error(`Get Model Performance error: ${error.message}`);
            throw new HttpException('Failed to fetch model performance', HttpStatus.BAD_REQUEST);
          })
        )
      ) as { success: boolean; message: string; data?: any[] };

      this.logger.log('=== GRPC RESULT (model performance) ===');
      this.logger.log(`success: ${result.success}, message: ${result.message}, records: ${result.data?.length || 0}`);

      return {
        success: result.success,
        message: result.message,
        data: result.data || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

}