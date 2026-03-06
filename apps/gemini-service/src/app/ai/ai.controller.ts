import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AiService } from './ai.service';

interface GetWeatherNotificationRequest {
  // Empty for now
}

interface LocalizedText {
  si: string;
  ta: string;
  en: string;
}

interface GetWeatherNotificationResponse {
  success: boolean;
  message: string;
  notification: LocalizedText;
  description: LocalizedText;
  plandays: number;
  startdate: string;
}

@Controller()
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  @GrpcMethod('AiService', 'GetWeatherNotification')
  async GetWeatherNotification(
    data: GetWeatherNotificationRequest
  ): Promise<GetWeatherNotificationResponse> {
    this.logger.log('Received GetWeatherNotification request');
    try {
      const result = await this.aiService.getWeatherNotification();
      return {
        success: true,
        message: 'Weather notification generated successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(`Error in GetWeatherNotification: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Failed to generate weather notification: ${error.message}`,
        notification: {
          si: '',
          ta: '',
          en: ''
        },
        description: {
          si: '',
          ta: '',
          en: ''
        },
        plandays: 45,
        startdate: new Date().toISOString().split('T')[0],
      };
    }
  }
}
