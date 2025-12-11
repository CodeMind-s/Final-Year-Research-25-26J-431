import { Controller, UseGuards, Inject, Post, Body, } from '@nestjs/common';
import { ClientGrpcProxy } from '@nestjs/microservices';
import { firstValueFrom, catchError } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { Logger } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { CreateDailyMeasurementDto, CreateDailyMeasurementResponseDto } from './dtos/dailyMeasurement.dto';

@ApiTags('Crystallization')
@Controller('crystallization')
export class CrystallizationController {
  private crystallizationService: any;
  private readonly logger = new Logger(CrystallizationController.name);

  constructor(@Inject('CRYSTALLIZATION_PACKAGE') private client: ClientGrpcProxy) {
    this.crystallizationService = this.client.getService('CrystallizationService');
  }

  @Post()
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
}