import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Batch, BatchDocument } from '../detection/schemas/batch.schema';
import {
  DetectionSession,
  DetectionSessionDocument,
} from '../detection/schemas/detection-session.schema';
import { ROIConfig } from '../roi/roi.service';

export interface BatchSummary {
  id: string;
  batchNumber: number;
  startTime: Date;
  endTime: Date | null;
  pureCount: number;
  impureCount: number;
  unwantedCount: number;
  totalCount: number;
  purityPercentage: number | null;
  frameCount: number;
  roi: ROIConfig;
  avgWhiteness: number | null;
  avgQualityScore: number | null;
  sessionId: string;
}

export interface BatchStats {
  pureCount: number;
  impureCount: number;
  unwantedCount: number;
  totalCount: number;
  purityPercentage: number;
  frameCount: number;
  avgWhiteness: number | null;
  avgQualityScore: number | null;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    @InjectModel(Batch.name)
    private readonly batchModel: Model<BatchDocument>,
    @InjectModel(DetectionSession.name)
    private readonly sessionModel: Model<DetectionSessionDocument>,
  ) {}

  async createBatch(sessionId: string, roi: ROIConfig): Promise<BatchSummary> {
    const lastBatch = await this.batchModel
      .findOne({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ batchNumber: -1 })
      .exec();

    const batchNumber = lastBatch ? lastBatch.batchNumber + 1 : 1;

    const batch = new this.batchModel({
      sessionId: new Types.ObjectId(sessionId),
      batchNumber,
      roi: {
        x: roi.x,
        y: roi.y,
        width: roi.width,
        height: roi.height,
      },
    });

    const saved = await batch.save();

    await this.sessionModel.findByIdAndUpdate(sessionId, {
      $inc: { totalBatches: 1 },
    }).exec();

    this.logger.log(`Created batch #${batchNumber} for session ${sessionId}`);

    return this.toBatchSummary(saved);
  }

  async endBatch(batchId: string): Promise<BatchSummary> {
    const batch = await this.batchModel
      .findByIdAndUpdate(
        batchId,
        { $set: { endTime: new Date() } },
        { new: true },
      )
      .exec();

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${batchId} not found`);
    }

    this.logger.log(
      `Ended batch #${batch.batchNumber}: ${batch.pureCount} pure, ${batch.impureCount} impure, ${batch.unwantedCount} unwanted, ${(batch.purityPercentage ?? 100).toFixed(1)}% purity`,
    );

    return this.toBatchSummary(batch);
  }

  async getBatch(batchId: string): Promise<BatchSummary | null> {
    const batch = await this.batchModel.findById(batchId).exec();
    return batch ? this.toBatchSummary(batch) : null;
  }

  async getAllBatches(
    page: number = 1,
    limit: number = 20,
    sessionId?: string,
  ): Promise<{ batches: BatchSummary[]; total: number }> {
    const filter: any = {};
    if (sessionId) {
      filter.sessionId = new Types.ObjectId(sessionId);
    }

    const [batches, total] = await Promise.all([
      this.batchModel
        .find(filter)
        .sort({ startTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.batchModel.countDocuments(filter).exec(),
    ]);

    return {
      batches: batches.map((b) => this.toBatchSummary(b)),
      total,
    };
  }

  async getSessionBatches(sessionId: string): Promise<BatchSummary[]> {
    const batches = await this.batchModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ batchNumber: -1 })
      .exec();

    return batches.map((batch) => this.toBatchSummary(batch));
  }

  async getRecentBatches(
    sessionId: string,
    limit: number = 10,
  ): Promise<BatchSummary[]> {
    const batches = await this.batchModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ batchNumber: -1 })
      .limit(limit)
      .exec();

    return batches.map((batch) => this.toBatchSummary(batch));
  }

  async setCurrentBatchSnapshot(
    batchId: string,
    pureCount: number,
    impureCount: number,
    unwantedCount: number,
    totalCount: number,
    avgWhiteness?: number,
    avgQualityScore?: number,
  ): Promise<void> {
    const saltCount = pureCount + impureCount;
    const purityPercentage = saltCount > 0 ? (pureCount / saltCount) * 100 : 100;

    await this.batchModel.findByIdAndUpdate(batchId, {
      $set: {
        pureCount,
        impureCount,
        unwantedCount,
        totalCount,
        purityPercentage,
        avgWhiteness: avgWhiteness ?? null,
        avgQualityScore: avgQualityScore ?? null,
      },
      $inc: { frameCount: 1 },
    }).exec();
  }

  async getCurrentBatchStats(batchId: string): Promise<BatchStats | null> {
    const batch = await this.batchModel.findById(batchId).exec();
    if (!batch) return null;

    const saltCount = batch.pureCount + batch.impureCount;
    const purityPercentage =
      saltCount > 0 ? (batch.pureCount / saltCount) * 100 : 100;

    return {
      pureCount: batch.pureCount,
      impureCount: batch.impureCount,
      unwantedCount: batch.unwantedCount,
      totalCount: batch.totalCount,
      purityPercentage,
      frameCount: batch.frameCount,
      avgWhiteness: batch.avgWhiteness,
      avgQualityScore: batch.avgQualityScore,
    };
  }

  async getBatchTrends(
    sessionId: string,
  ): Promise<{ batchNumber: number; purityPercentage: number }[]> {
    const batches = await this.batchModel
      .find({
        sessionId: new Types.ObjectId(sessionId),
        endTime: { $ne: null },
      })
      .sort({ batchNumber: 1 })
      .select({ batchNumber: 1, purityPercentage: 1 })
      .exec();

    return batches.map((b) => ({
      batchNumber: b.batchNumber,
      purityPercentage: b.purityPercentage ?? 100,
    }));
  }

  private toBatchSummary(batch: BatchDocument): BatchSummary {
    return {
      id: batch._id.toString(),
      batchNumber: batch.batchNumber,
      startTime: batch.startTime,
      endTime: batch.endTime,
      pureCount: batch.pureCount,
      impureCount: batch.impureCount,
      unwantedCount: batch.unwantedCount,
      totalCount: batch.totalCount,
      purityPercentage: batch.purityPercentage,
      frameCount: batch.frameCount,
      roi: {
        x: batch.roi.x,
        y: batch.roi.y,
        width: batch.roi.width,
        height: batch.roi.height,
      },
      avgWhiteness: batch.avgWhiteness,
      avgQualityScore: batch.avgQualityScore,
      sessionId: batch.sessionId.toString(),
    };
  }
}
