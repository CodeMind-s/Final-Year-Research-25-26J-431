import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { StatisticsService } from './statistics.service';

@Controller()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @GrpcMethod('VisionService', 'GetStatsSummary')
  async getStatsSummary(data: { startDate?: string; endDate?: string; user_id?: string; source?: string }) {
    return this.statisticsService.getSummary(data.startDate, data.endDate, data.user_id, data.source);
  }

  @GrpcMethod('VisionService', 'GetStatsHourly')
  async getStatsHourly(data: { date?: string; user_id?: string; source?: string }) {
    const stats = await this.statisticsService.getHourlyStats(data.date, data.user_id, data.source);
    return { stats };
  }

  @GrpcMethod('VisionService', 'GetStatsDaily')
  async getStatsDaily(data: { startDate?: string; endDate?: string; limit?: number; user_id?: string; source?: string }) {
    const stats = await this.statisticsService.getDailyStats(
      data.startDate,
      data.endDate,
      data.limit || 30,
      data.user_id,
      data.source,
    );
    return { stats };
  }

  @GrpcMethod('VisionService', 'GetStatsTrends')
  async getStatsTrends(data: { period?: string; limit?: number; user_id?: string }) {
    const trends = await this.statisticsService.getTrends(
      data.period || 'daily',
      data.limit || 30,
      data.user_id,
    );
    return { trends };
  }
}
