import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { DetectionService } from './detection.service';
import { InferenceService } from '../inference/inference.service';
import { WhitenessService } from '../inference/whiteness.service';
import { ROIService } from '../roi/roi.service';
import { BatchService } from '../batch/batch.service';
import { DetectionSession, DetectionSessionDocument } from './schemas/detection-session.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Controller()
export class DetectionController {
  constructor(
    private readonly detectionService: DetectionService,
    private readonly inferenceService: InferenceService,
    private readonly whitenessService: WhitenessService,
    private readonly roiService: ROIService,
    private readonly batchService: BatchService,
    @InjectModel(DetectionSession.name)
    private readonly sessionModel: Model<DetectionSessionDocument>,
  ) {}

  @GrpcMethod('VisionService', 'ProcessFrame')
  async processFrame(data: {
    imageData: Buffer;
    sessionId?: string;
    batchId?: string;
    roi?: { x: number; y: number; width: number; height: number };
    saveDetection?: boolean;
    user_id?: string;
  }) {
    const imageBuffer = Buffer.from(data.imageData);
    const result = await this.inferenceService.runInference(imageBuffer);

    const roi = data.roi && data.roi.width > 0
      ? data.roi
      : this.roiService.getDefaultROI();

    const roiStats = this.roiService.calculateROIStats(result.boundingBoxes, roi);
    const boundingBoxesWithROI = this.roiService.markBoxesWithROI(result.boundingBoxes, roi);

    const boundingBoxesWithWhiteness = await this.whitenessService.calculateWhiteness(
      imageBuffer,
      boundingBoxesWithROI,
      result.frameWidth,
      result.frameHeight,
    );

    const whitenessStats = this.whitenessService.calculateAggregateStats(boundingBoxesWithWhiteness);
    const roiWhitenessStats = this.whitenessService.calculateROIAggregateStats(boundingBoxesWithWhiteness);

    let batchStats = null;

    if (data.saveDetection && data.batchId) {
      await this.detectionService.create({
        userId: data.user_id || '',
        frameWidth: result.frameWidth,
        frameHeight: result.frameHeight,
        processingTimeMs: result.processingTimeMs,
        sessionId: data.sessionId,
        batchId: data.batchId,
        roiPureCount: roiStats.pureCount,
        roiImpureCount: roiStats.impureCount,
        roiUnwantedCount: roiStats.unwantedCount,
        roiTotalCount: roiStats.totalCount,
        roiPurityPercentage: roiStats.purityPercentage,
        avgWhiteness: whitenessStats.avgWhiteness,
        avgQualityScore: whitenessStats.avgQualityScore,
        roiAvgWhiteness: roiWhitenessStats.avgWhiteness,
        roiAvgQualityScore: roiWhitenessStats.avgQualityScore,
        boundingBoxes: boundingBoxesWithWhiteness.map((box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          classId: box.classId,
          className: box.className,
          confidence: box.confidence,
          whitenessPercentage: box.whitenessPercentage,
          qualityScore: box.qualityScore,
        })),
      });

      if (data.sessionId) {
        await this.detectionService.incrementSessionStats(
          data.sessionId,
          roiStats.pureCount,
          roiStats.impureCount,
          roiStats.unwantedCount,
        );
      }

      await this.batchService.setCurrentBatchSnapshot(
        data.batchId,
        roiStats.pureCount,
        roiStats.impureCount,
        roiStats.unwantedCount,
        roiStats.totalCount,
        roiWhitenessStats.avgWhiteness,
        roiWhitenessStats.avgQualityScore,
      );

      batchStats = await this.batchService.getCurrentBatchStats(data.batchId);
    }

    return {
      frameId: result.frameId,
      timestamp: result.timestamp,
      processingTimeMs: result.processingTimeMs,
      pureCount: result.pureCount,
      impureCount: result.impureCount,
      unwantedCount: result.unwantedCount,
      totalCount: result.totalCount,
      purityPercentage: result.purityPercentage,
      roiPureCount: roiStats.pureCount,
      roiImpureCount: roiStats.impureCount,
      roiUnwantedCount: roiStats.unwantedCount,
      roiTotalCount: roiStats.totalCount,
      roiPurityPercentage: roiStats.purityPercentage,
      avgWhiteness: whitenessStats.avgWhiteness,
      avgQualityScore: whitenessStats.avgQualityScore,
      roiAvgWhiteness: roiWhitenessStats.avgWhiteness,
      roiAvgQualityScore: roiWhitenessStats.avgQualityScore,
      boundingBoxes: boundingBoxesWithWhiteness.map((box) => ({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        classId: box.classId,
        className: box.className,
        confidence: box.confidence,
        color: box.color,
        insideROI: box.insideROI ?? false,
        whitenessPercentage: box.whitenessPercentage ?? 0,
        qualityScore: box.qualityScore ?? 0,
      })),
      frameWidth: result.frameWidth,
      frameHeight: result.frameHeight,
      roi,
      currentBatchId: data.batchId || '',
      currentBatchNumber: 0,
      batchStats: batchStats || undefined,
    };
  }

  @GrpcMethod('VisionService', 'CreateSession')
  async createSession(data: {
    cameraSource?: string;
    roi?: { x: number; y: number; width: number; height: number };
    user_id?: string;
  }) {
    const roi = data.roi && data.roi.width > 0
      ? data.roi
      : this.roiService.getDefaultROI();

    const session = new this.sessionModel({
      userId: new Types.ObjectId(data.user_id),
      cameraSource: data.cameraSource || null,
      roi: { x: roi.x, y: roi.y, width: roi.width, height: roi.height },
    });

    const saved = await session.save();
    return this.toSessionResponse(saved);
  }

  @GrpcMethod('VisionService', 'EndSession')
  async endSession(data: { sessionId: string }) {
    const session = await this.sessionModel.findById(data.sessionId).exec();
    if (!session) {
      throw new Error(`Session ${data.sessionId} not found`);
    }

    session.endTime = new Date();

    const saltCount = session.totalPureCount + session.totalImpureCount;
    session.avgPurityPercent = saltCount > 0
      ? (session.totalPureCount / saltCount) * 100
      : 100;

    const saved = await session.save();
    return this.toSessionResponse(saved);
  }

  @GrpcMethod('VisionService', 'GetSession')
  async getSession(data: { sessionId: string }) {
    const session = await this.sessionModel.findById(data.sessionId).exec();
    if (!session) {
      throw new Error(`Session ${data.sessionId} not found`);
    }
    return this.toSessionResponse(session);
  }

  @GrpcMethod('VisionService', 'GetDetections')
  async getDetections(data: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    minPurity?: number;
    maxPurity?: number;
    sessionId?: string;
    user_id?: string;
  }) {
    const result = await this.detectionService.findAll({
      ...data,
      userId: data.user_id,
    });

    return {
      detections: result.data.map((d) => ({
        id: d._id.toString(),
        timestamp: d.timestamp.toISOString(),
        frameWidth: d.frameWidth,
        frameHeight: d.frameHeight,
        processingTimeMs: d.processingTimeMs,
        pureCount: d.pureCount,
        impureCount: d.impureCount,
        unwantedCount: d.unwantedCount,
        totalCount: d.totalCount,
        purityPercentage: d.purityPercentage,
        roiPureCount: d.roiPureCount,
        roiImpureCount: d.roiImpureCount,
        roiUnwantedCount: d.roiUnwantedCount,
        roiTotalCount: d.roiTotalCount,
        roiPurityPercentage: d.roiPurityPercentage ?? 0,
        avgWhiteness: d.avgWhiteness ?? 0,
        avgQualityScore: d.avgQualityScore ?? 0,
        roiAvgWhiteness: d.roiAvgWhiteness ?? 0,
        roiAvgQualityScore: d.roiAvgQualityScore ?? 0,
        sessionId: d.sessionId?.toString() || '',
        batchId: d.batchId?.toString() || '',
        user_id: d.userId?.toString() || '',
        boundingBoxes: d.boundingBoxes.map((box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          classId: box.classId,
          className: box.className,
          confidence: box.confidence,
          color: '',
          insideROI: false,
          whitenessPercentage: box.whitenessPercentage ?? 0,
          qualityScore: box.qualityScore ?? 0,
        })),
      })),
      meta: result.meta,
    };
  }

  @GrpcMethod('VisionService', 'GetDetection')
  async getDetection(data: { id: string }) {
    const d = await this.detectionService.findOne(data.id);

    return {
      detection: {
        id: d._id.toString(),
        timestamp: d.timestamp.toISOString(),
        frameWidth: d.frameWidth,
        frameHeight: d.frameHeight,
        processingTimeMs: d.processingTimeMs,
        pureCount: d.pureCount,
        impureCount: d.impureCount,
        unwantedCount: d.unwantedCount,
        totalCount: d.totalCount,
        purityPercentage: d.purityPercentage,
        roiPureCount: d.roiPureCount,
        roiImpureCount: d.roiImpureCount,
        roiUnwantedCount: d.roiUnwantedCount,
        roiTotalCount: d.roiTotalCount,
        roiPurityPercentage: d.roiPurityPercentage ?? 0,
        avgWhiteness: d.avgWhiteness ?? 0,
        avgQualityScore: d.avgQualityScore ?? 0,
        roiAvgWhiteness: d.roiAvgWhiteness ?? 0,
        roiAvgQualityScore: d.roiAvgQualityScore ?? 0,
        sessionId: d.sessionId?.toString() || '',
        batchId: d.batchId?.toString() || '',
        user_id: d.userId?.toString() || '',
        boundingBoxes: d.boundingBoxes.map((box) => ({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          classId: box.classId,
          className: box.className,
          confidence: box.confidence,
          color: '',
          insideROI: false,
          whitenessPercentage: box.whitenessPercentage ?? 0,
          qualityScore: box.qualityScore ?? 0,
        })),
      },
    };
  }

  @GrpcMethod('VisionService', 'DeleteDetection')
  async deleteDetection(data: { id: string }) {
    await this.detectionService.remove(data.id);
    return { success: true, message: 'Detection deleted successfully' };
  }

  private toSessionResponse(session: DetectionSessionDocument) {
    return {
      id: session._id.toString(),
      startTime: session.startTime.toISOString(),
      endTime: session.endTime ? session.endTime.toISOString() : '',
      totalFrames: session.totalFrames,
      totalPureCount: session.totalPureCount,
      totalImpureCount: session.totalImpureCount,
      totalUnwantedCount: session.totalUnwantedCount,
      avgPurityPercent: session.avgPurityPercent ?? 0,
      totalBatches: session.totalBatches,
      avgWhiteness: session.avgWhiteness ?? 0,
      avgQualityScore: session.avgQualityScore ?? 0,
      roi: session.roi
        ? { x: session.roi.x, y: session.roi.y, width: session.roi.width, height: session.roi.height }
        : { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
      cameraSource: session.cameraSource || '',
      notes: session.notes || '',
      user_id: session.userId?.toString() || '',
    };
  }
}
