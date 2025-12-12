import { Controller, UseGuards, Inject, Post, Body, Get, Patch, Param, Delete } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto, GetDailyMeasurementResponseDto, UpdateDailyMeasurementByIdDto, UpdateDailyMeasurementByIdResponseDto, DeleteDailyMeasurementByIdResponseDto } from './dtos/dailyMeasurement.dto';

@ApiTags('Crystallization')
@Controller('crystallization')
export class CrystallizationController {
  private crystallizationService: any;
  private readonly logger = new Logger(CrystallizationController.name);

  constructor(@Inject('CRYSTALLIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.crystallizationService = this.client.getService('CrystallizationService');
  }

  @Post("/daily-measurement")
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Daily Measurement' })
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
      ) as { success: boolean; message: string; daily_measurement?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));
      this.logger.log('Result keys:', Object.keys(result));
      this.logger.log('daily_measurement:', result.daily_measurement);
      this.logger.log('dailyMeasurement (camelCase):', result['dailyMeasurement']);
      this.logger.log('Has daily_measurement?', 'daily_measurement' in result);
      this.logger.log('Has dailyMeasurement?', 'dailyMeasurement' in result);

      // Map gRPC response to DTO structure
      // Transform the daily_measurement data if it exists
      let data = null;
      const measurement = result.daily_measurement || result['dailyMeasurement'];

      if (measurement) {
        this.logger.log('Found measurement data:', measurement);
        data = {
          date: measurement.date,
          waterTemperature: measurement.waterTemperature,
          lagoon: measurement.lagoon,
          orBrineLevel: measurement.orBrineLevel,
          orBoundLevel: measurement.orBoundLevel,
          irBrineLevel: measurement.irBrineLevel,
          irBoundLevel: measurement.irBoundLevel,
          eastChannel: measurement.eastChannel,
          westChannel: measurement.westChannel,
          _id: measurement._id,
          createdAt: measurement.createdAt,
          updatedAt: measurement.updatedAt,
        };
      } else {
        this.logger.warn('No measurement data found in response!');
      }

      return {
        success: result.success,
        message: result.message,
        data,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Get("daily-measurement/:date")
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Daily Measurement by Date' })
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
      ) as { success: boolean; message: string; daily_measurement?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      // Map gRPC response to DTO structure
      let data = null;
      const measurement = result.daily_measurement || result['dailyMeasurement'];

      if (measurement) {
        this.logger.log('Found measurement data:', measurement);
        data = {
          date: measurement.date,
          waterTemperature: measurement.waterTemperature,
          lagoon: measurement.lagoon,
          orBrineLevel: measurement.orBrineLevel,
          orBoundLevel: measurement.orBoundLevel,
          irBrineLevel: measurement.irBrineLevel,
          irBoundLevel: measurement.irBoundLevel,
          eastChannel: measurement.eastChannel,
          westChannel: measurement.westChannel,
          _id: measurement._id,
          createdAt: measurement.createdAt,
          updatedAt: measurement.updatedAt,
        };
      } else {
        this.logger.log('No measurement data found in response');
      }

      return {
        success: result.success,
        message: result.message,
        data,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch("daily-measurement/:id")
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Daily Measurement by ID' })
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
      ) as { success: boolean; message: string; daily_measurement?: any };

      this.logger.log('=== GRPC RESULT ===');
      this.logger.log(JSON.stringify(result, null, 2));

      // Map gRPC response to DTO structure
      let data = null;
      const measurement = result.daily_measurement || result['dailyMeasurement'];

      if (measurement) {
        this.logger.log('Found measurement data:', measurement);
        data = {
          date: measurement.date,
          waterTemperature: measurement.waterTemperature,
          lagoon: measurement.lagoon,
          orBrineLevel: measurement.orBrineLevel,
          orBoundLevel: measurement.orBoundLevel,
          irBrineLevel: measurement.irBrineLevel,
          irBoundLevel: measurement.irBoundLevel,
          eastChannel: measurement.eastChannel,
          westChannel: measurement.westChannel,
          _id: measurement._id,
          createdAt: measurement.createdAt,
          updatedAt: measurement.updatedAt,
        };
      } else {
        this.logger.log('No measurement data found in response');
      }

      return {
        success: result.success,
        message: result.message,
        data,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete("daily-measurement/:id")
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete Daily Measurement by ID' })
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

}