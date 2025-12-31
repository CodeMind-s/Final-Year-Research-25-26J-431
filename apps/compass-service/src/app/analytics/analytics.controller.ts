import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AnalyticsService } from './analytics.service';
import {
  GetLandownerAnalyticsRequestDto,
  GetLandownerAnalyticsResponseDto,
  GetSellerAnalyticsRequestDto,
  GetSellerAnalyticsResponseDto,
} from './dtos/analytics.dto';

@Controller('Analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @GrpcMethod('AnalyticsService', 'GetLandownerAnalytics')
  async GetLandownerAnalytics(
    data: GetLandownerAnalyticsRequestDto
  ): Promise<GetLandownerAnalyticsResponseDto> {
    return this.analyticsService.getLandownerAnalytics(data);
  }

  @GrpcMethod('AnalyticsService', 'GetSellerAnalytics')
  async GetSellerAnalytics(
    data: GetSellerAnalyticsRequestDto
  ): Promise<GetSellerAnalyticsResponseDto> {
    return this.analyticsService.getSellerAnalytics(data);
  }
}
