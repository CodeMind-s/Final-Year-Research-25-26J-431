import { Controller, Get, Logger, HttpStatus, Inject, OnModuleInit } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WeatherNotificationResponseDto } from './dtos/weather-notification.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/decorators/role.enum';
import * as grpc from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

interface AiService {
  GetWeatherNotification(data: {}): Observable<any>;
}

@ApiTags('AI Services')
@Controller('ai')
export class AiController implements OnModuleInit {
  private readonly logger = new Logger(AiController.name);
  private aiService: AiService;

  constructor(@Inject('AI_PACKAGE') private aiClient: grpc.ClientGrpc) {}

  onModuleInit() {
    this.aiService = this.aiClient.getService<AiService>('AiService');
  }

  @Get('plan-creating-hint')
  @Roles(Role.LANDOWNER, Role.SALTSOCIETY)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get AI-powered weather notification and harvest planning recommendation (landowner/saltsociety)' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Weather notification with harvest recommendation generated successfully',
    type: WeatherNotificationResponseDto 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized - Invalid or missing authentication token' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Forbidden - User does not have required role (landowner or saltsociety)' 
  })
  @ApiResponse({ 
    status: HttpStatus.INTERNAL_SERVER_ERROR, 
    description: 'Failed to generate weather notification' 
  })
  async getWeatherNotification(): Promise<WeatherNotificationResponseDto> {
    this.logger.log('Received request for weather notification');
    
    const result = await firstValueFrom(
      this.aiService.GetWeatherNotification({})
    );

    if (!result.success) {
      throw new Error(result.message || 'Failed to generate weather notification');
    }

    return {
      notification: result.notification,
      description: result.description,
      plandays: result.plandays,
      startdate: result.startdate,
    };
  }
}
