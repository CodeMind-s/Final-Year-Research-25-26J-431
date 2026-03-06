import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Detection, DetectionDocument } from '../detection/schemas/detection.schema';
import { Batch, BatchDocument } from '../detection/schemas/batch.schema';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Detection.name)
    private readonly detectionModel: Model<DetectionDocument>,
    @InjectModel(Batch.name)
    private readonly batchModel: Model<BatchDocument>,
  ) {}

  async getSummary(startDate?: string, endDate?: string, userId?: string, source?: string) {
    if (source === 'batches') {
      return this.getBatchSummary(startDate, endDate, userId);
    }
    return this.getDetectionSummary(startDate, endDate, userId);
  }

  async getHourlyStats(date?: string, userId?: string, source?: string) {
    if (source === 'batches') {
      return this.getBatchHourlyStats(date, userId);
    }
    return this.getDetectionHourlyStats(date, userId);
  }

  async getDailyStats(startDate?: string, endDate?: string, limit: number = 30, userId?: string, source?: string) {
    if (source === 'batches') {
      return this.getBatchDailyStats(startDate, endDate, limit, userId);
    }
    return this.getDetectionDailyStats(startDate, endDate, limit, userId);
  }

  async getTrends(period: string = 'daily', limit: number = 30, userId?: string) {
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

    const filter: any = {
      timestamp: { $gte: startDate },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const detections = await this.detectionModel
      .find(filter)
      .select({ purityPercentage: 1, timestamp: 1 })
      .sort({ timestamp: 1 })
      .exec();

    return detections.map((d) => ({
      timestamp: d.timestamp.toISOString(),
      purity: d.purityPercentage,
    }));
  }

  // ─── Detection-based statistics ─────────────────────────────

  private async getDetectionSummary(startDate?: string, endDate?: string, userId?: string) {
    const match: any = {};

    if (userId) {
      match.userId = new Types.ObjectId(userId);
    }

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
        totalBatches: 0,
        averageWhiteness: 0,
        averageQualityScore: 0,
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
      totalBatches: 0,
      averageWhiteness: 0,
      averageQualityScore: 0,
    };
  }

  private async getDetectionHourlyStats(date?: string, userId?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter: any = {
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const detections = await this.detectionModel
      .find(filter)
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

  private async getDetectionDailyStats(startDate?: string, endDate?: string, limit: number = 30, userId?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - limit * 24 * 60 * 60 * 1000);

    const filter: any = {
      timestamp: { $gte: start, $lte: end },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const detections = await this.detectionModel
      .find(filter)
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

  // ─── Batch-based statistics ─────────────────────────────────

  private async getBatchSummary(startDate?: string, endDate?: string, userId?: string) {
    const match: any = {};

    if (userId) {
      match.userId = new Types.ObjectId(userId);
    }

    if (startDate || endDate) {
      match.startTime = {};
      if (startDate) match.startTime.$gte = new Date(startDate);
      if (endDate) match.startTime.$lte = new Date(endDate);
    }

    const batches = await this.batchModel
      .find(match)
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        totalCount: 1,
        purityPercentage: 1,
        frameCount: 1,
        avgWhiteness: 1,
        avgQualityScore: 1,
        startTime: 1,
        endTime: 1,
      })
      .exec();

    if (batches.length === 0) {
      return {
        totalDetections: 0,
        totalBatches: 0,
        totalPure: 0,
        totalImpure: 0,
        totalUnwanted: 0,
        averagePurity: 100,
        averageProcessingTime: 0,
        detectionsPerHour: 0,
        averageWhiteness: 0,
        averageQualityScore: 0,
        periodStart: startDate || '',
        periodEnd: endDate || '',
      };
    }

    const totalBatches = batches.length;
    const totalPure = batches.reduce((sum, b) => sum + b.pureCount, 0);
    const totalImpure = batches.reduce((sum, b) => sum + b.impureCount, 0);
    const totalUnwanted = batches.reduce((sum, b) => sum + b.unwantedCount, 0);
    const totalFrames = batches.reduce((sum, b) => sum + b.frameCount, 0);

    const validPurity = batches.filter((b) => b.purityPercentage !== null);
    const averagePurity = validPurity.length > 0
      ? validPurity.reduce((sum, b) => sum + (b.purityPercentage ?? 0), 0) / validPurity.length
      : 100;

    const validWhiteness = batches.filter((b) => b.avgWhiteness !== null);
    const averageWhiteness = validWhiteness.length > 0
      ? validWhiteness.reduce((sum, b) => sum + (b.avgWhiteness ?? 0), 0) / validWhiteness.length
      : 0;

    const validQuality = batches.filter((b) => b.avgQualityScore !== null);
    const averageQualityScore = validQuality.length > 0
      ? validQuality.reduce((sum, b) => sum + (b.avgQualityScore ?? 0), 0) / validQuality.length
      : 0;

    const timestamps = batches.map((b) => b.startTime.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const hoursDiff = Math.max((maxTime - minTime) / (1000 * 60 * 60), 1);
    const batchesPerHour = totalBatches / hoursDiff;

    return {
      totalDetections: totalFrames,
      totalBatches,
      totalPure,
      totalImpure,
      totalUnwanted,
      averagePurity: Math.round(averagePurity * 100) / 100,
      averageProcessingTime: 0,
      detectionsPerHour: Math.round(batchesPerHour * 100) / 100,
      averageWhiteness: Math.round(averageWhiteness * 100) / 100,
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      periodStart: startDate || new Date(minTime).toISOString(),
      periodEnd: endDate || new Date(maxTime).toISOString(),
    };
  }

  private async getBatchHourlyStats(date?: string, userId?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter: any = {
      startTime: { $gte: startOfDay, $lte: endOfDay },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const batches = await this.batchModel
      .find(filter)
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        purityPercentage: 1,
        startTime: 1,
      })
      .exec();

    const hourlyData: Record<
      number,
      { count: number; pure: number; impure: number; unwanted: number; puritySum: number; purityCount: number }
    > = {};

    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { count: 0, pure: 0, impure: 0, unwanted: 0, puritySum: 0, purityCount: 0 };
    }

    batches.forEach((b) => {
      const hour = b.startTime.getHours();
      hourlyData[hour].count++;
      hourlyData[hour].pure += b.pureCount;
      hourlyData[hour].impure += b.impureCount;
      hourlyData[hour].unwanted += b.unwantedCount;
      if (b.purityPercentage !== null) {
        hourlyData[hour].puritySum += b.purityPercentage;
        hourlyData[hour].purityCount++;
      }
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      detections: data.count,
      pureCount: data.pure,
      impureCount: data.impure,
      unwantedCount: data.unwanted,
      avgPurity: data.purityCount > 0 ? Math.round((data.puritySum / data.purityCount) * 100) / 100 : 100,
    }));
  }

  private async getBatchDailyStats(startDate?: string, endDate?: string, limit: number = 30, userId?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - limit * 24 * 60 * 60 * 1000);

    const filter: any = {
      startTime: { $gte: start, $lte: end },
    };
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const batches = await this.batchModel
      .find(filter)
      .select({
        pureCount: 1,
        impureCount: 1,
        unwantedCount: 1,
        purityPercentage: 1,
        startTime: 1,
      })
      .sort({ startTime: 1 })
      .exec();

    const dailyData: Record<
      string,
      { count: number; pure: number; impure: number; unwanted: number; puritySum: number; purityCount: number }
    > = {};

    batches.forEach((b) => {
      const dateKey = b.startTime.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { count: 0, pure: 0, impure: 0, unwanted: 0, puritySum: 0, purityCount: 0 };
      }
      dailyData[dateKey].count++;
      dailyData[dateKey].pure += b.pureCount;
      dailyData[dateKey].impure += b.impureCount;
      dailyData[dateKey].unwanted += b.unwantedCount;
      if (b.purityPercentage !== null) {
        dailyData[dateKey].puritySum += b.purityPercentage;
        dailyData[dateKey].purityCount++;
      }
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      detections: data.count,
      pureCount: data.pure,
      impureCount: data.impure,
      unwantedCount: data.unwanted,
      avgPurity: data.purityCount > 0 ? Math.round((data.puritySum / data.purityCount) * 100) / 100 : 100,
    }));
  }
}
