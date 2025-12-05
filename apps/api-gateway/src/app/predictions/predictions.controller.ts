import { Controller, Post, Body, Inject, OnModuleInit, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PredictionRequestDto } from './dtos/prediction-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import { SubscriptionCheck } from '../auth/decorators/public.decorator';

interface CurrentValues {
  waterTemperature: number;
  lagoon: number;
  orBrineLevel: number;
  orBundLevel: number;
  irBrineLevel: number;
  irBoundLevel: number;
  eastChannel: number;
  westChannel: number;
}

interface PredictionRequest {
  startDate: string;
  forecastDays: number;
  currentValues: CurrentValues;
}

interface PredictionsService {
  getPredictions(data: PredictionRequest): Observable<any>;
}

@ApiTags('Crystallization')
@Controller('crystallization/predictions')
export class PredictionsController implements OnModuleInit {
  private predictionsService: PredictionsService;

  constructor(
    @Inject('PREDICTIONS_PACKAGE') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.predictionsService = this.client.getService<PredictionsService>('PredictionsService');
  }

  @Post()
  @UseGuards(JwtAuthGuard, SubscriptionGuard)
  @Roles(Role.TRAVELER)
  @SubscriptionCheck(0)
  @ApiBearerAuth ()
  @ApiOperation({ summary: 'Get ML predictions for crystallization parameters' })
  @ApiBody({ type: PredictionRequestDto })
  @ApiResponse({ status: 200, description: 'Predictions generated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getPredictions(@Body() predictionRequest: PredictionRequestDto) {
    try {
      const payload = {
        startDate: predictionRequest.start_date,
        forecastDays: predictionRequest.forecast_days,
        currentValues: {
          waterTemperature: predictionRequest.current_values.water_temperature,
          lagoon: predictionRequest.current_values.lagoon,
          orBrineLevel: predictionRequest.current_values.OR_brine_level,
          orBundLevel: predictionRequest.current_values.OR_bund_level,
          irBrineLevel: predictionRequest.current_values.IR_brine_level,
          irBoundLevel: predictionRequest.current_values.IR_bound_level,
          eastChannel: predictionRequest.current_values.East_channel,
          westChannel: predictionRequest.current_values.West_channel,
        },
      };
      
      const result = await firstValueFrom(
        this.predictionsService.getPredictions(payload)
      );

      return result;
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Failed to get predictions',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
