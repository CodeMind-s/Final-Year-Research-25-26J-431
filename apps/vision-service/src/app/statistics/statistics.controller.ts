import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { StatisticsService } from './statistics.service';

@Controller()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @GrpcMethod('VisionService', 'GetStatsSummary')
  async getStatsSummary(data: { startDate?: string; endDate?: string }) {
    return this.statisticsService.getSummary(data.startDate, data.endDate);
  }

  @GrpcMethod('VisionService', 'GetStatsHourly')
  async getStatsHourly(data: { date?: string }) {
    const stats = await this.statisticsService.getHourlyStats(data.date);
    return { stats };
  }

  @GrpcMethod('VisionService', 'GetStatsDaily')
  async getStatsDaily(data: { startDate?: string; endDate?: string; limit?: number }) {
    const stats = await this.statisticsService.getDailyStats(
      data.startDate,
      data.endDate,
      data.limit || 30,
    );
    return { stats };
  }

  @GrpcMethod('VisionService', 'GetStatsTrends')
  async getStatsTrends(data: { period?: string; limit?: number }) {
    const trends = await this.statisticsService.getTrends(
      data.period || 'daily',
      data.limit || 30,
    );
    return { trends };
  }
}
