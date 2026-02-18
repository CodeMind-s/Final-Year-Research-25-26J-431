import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Detection, DetectionDocument } from '../detection/schemas/detection.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Detection.name)
    private readonly detectionModel: Model<DetectionDocument>,
  ) {}

  async getSummary(startDate?: string, endDate?: string) {
    const match: any = {};

    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    const detections = await this.detectionModel
      .find(match)
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        purityPercentage: 1,
        processingTimeMs: 1,
        timestamp: 1,
      })
      .exec();

    if (detections.length === 0) {
      return {
        totalDetections: 0,
        totalPure: 0,
        totalImpure: 0,
        totalUnwanted: 0,
        averagePurity: 100,
        averageProcessingTime: 0,
        detectionsPerHour: 0,
        periodStart: startDate || '',
        periodEnd: endDate || '',
      };
    }

    const totalDetections = detections.length;
    const totalPure = detections.reduce((sum, d) => sum + d.pureCount, 0);
    const totalImpure = detections.reduce((sum, d) => sum + d.impureCount, 0);
    const totalUnwanted = detections.reduce((sum, d) => sum + d.unwantedCount, 0);
    const averagePurity =
      detections.reduce((sum, d) => sum + d.purityPercentage, 0) / totalDetections;
    const averageProcessingTime =
      detections.reduce((sum, d) => sum + d.processingTimeMs, 0) / totalDetections;

    const timestamps = detections.map((d) => d.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const hoursDiff = Math.max((maxTime - minTime) / (1000 * 60 * 60), 1);
    const detectionsPerHour = totalDetections / hoursDiff;

    return {
      totalDetections,
      totalPure,
      totalImpure,
      totalUnwanted,
      averagePurity: Math.round(averagePurity * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      detectionsPerHour: Math.round(detectionsPerHour * 100) / 100,
      periodStart: startDate || new Date(minTime).toISOString(),
      periodEnd: endDate || new Date(maxTime).toISOString(),
    };
  }

  async getHourlyStats(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const detections = await this.detectionModel
      .find({
        timestamp: { $gte: startOfDay, $lte: endOfDay },
      })
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        purityPercentage: 1,
        timestamp: 1,
      })
      .exec();

    const hourlyData: Record<
      number,
      { count: number; pure: number; impure: number; unwanted: number; puritySum: number }
    > = {};

    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { count: 0, pure: 0, impure: 0, unwanted: 0, puritySum: 0 };
    }

    detections.forEach((d) => {
      const hour = d.timestamp.getHours();
      hourlyData[hour].count++;
      hourlyData[hour].pure += d.pureCount;
      hourlyData[hour].impure += d.impureCount;
      hourlyData[hour].unwanted += d.unwantedCount;
      hourlyData[hour].puritySum += d.purityPercentage;
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      detections: data.count,
      pureCount: data.pure,
      impureCount: data.impure,
      unwantedCount: data.unwanted,
      avgPurity: data.count > 0 ? Math.round((data.puritySum / data.count) * 100) / 100 : 100,
    }));
  }

  async getDailyStats(startDate?: string, endDate?: string, limit: number = 30) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - limit * 24 * 60 * 60 * 1000);

    const detections = await this.detectionModel
      .find({
        timestamp: { $gte: start, $lte: end },
      })
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        purityPercentage: 1,
        timestamp: 1,
      })
      .sort({ timestamp: 1 })
      .exec();

    const dailyData: Record<
      string,
      { count: number; pure: number; impure: number; unwanted: number; puritySum: number }
    > = {};

    detections.forEach((d) => {
      const dateKey = d.timestamp.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { count: 0, pure: 0, impure: 0, unwanted: 0, puritySum: 0 };
      }
      dailyData[dateKey].count++;
      dailyData[dateKey].pure += d.pureCount;
      dailyData[dateKey].impure += d.impureCount;
      dailyData[dateKey].unwanted += d.unwantedCount;
      dailyData[dateKey].puritySum += d.purityPercentage;
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      detections: data.count,
      pureCount: data.pure,
      impureCount: data.impure,
      unwantedCount: data.unwanted,
      avgPurity: data.count > 0 ? Math.round((data.puritySum / data.count) * 100) / 100 : 100,
    }));
  }

  async getTrends(period: string = 'daily', limit: number = 30) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hourly':
        startDate = new Date(now.getTime() - limit * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - limit * 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - limit * 24 * 60 * 60 * 1000);
    }

    const detections = await this.detectionModel
      .find({
        timestamp: { $gte: startDate },
      })
      .select({ purityPercentage: 1, timestamp: 1 })
      .sort({ timestamp: 1 })
      .exec();

    return detections.map((d) => ({
      timestamp: d.timestamp.toISOString(),
      purity: d.purityPercentage,
    }));
  }
}
