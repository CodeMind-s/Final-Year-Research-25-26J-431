import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Detection, DetectionDocument } from './schemas/detection.schema';
import {
  DetectionSession,
  DetectionSessionDocument,
} from './schemas/detection-session.schema';

export interface CreateDetectionDto {
  frameWidth: number;
  frameHeight: number;
  processingTimeMs: number;
  sessionId?: string;
  batchId?: string;
  roiPureCount?: number;
  roiImpureCount?: number;
  roiUnwantedCount?: number;
  roiTotalCount?: number;
  roiPurityPercentage?: number;
  avgWhiteness?: number;
  avgQualityScore?: number;
  roiAvgWhiteness?: number;
  roiAvgQualityScore?: number;
  boundingBoxes: {
    x: number;
    y: number;
    width: number;
    height: number;
    classId: number;
    className: string;
    confidence: number;
    whitenessPercentage?: number;
    qualityScore?: number;
  }[];
}

export interface DetectionFilter {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  minPurity?: number;
  maxPurity?: number;
  sessionId?: string;
}

@Injectable()
export class DetectionService {
  constructor(
    @InjectModel(Detection.name)
    private readonly detectionModel: Model<DetectionDocument>,
    @InjectModel(DetectionSession.name)
    private readonly sessionModel: Model<DetectionSessionDocument>,
  ) {}

  async create(dto: CreateDetectionDto): Promise<DetectionDocument> {
    const impureCount = dto.boundingBoxes.filter((b) => b.classId === 0).length;
    const pureCount = dto.boundingBoxes.filter((b) => b.classId === 1).length;
    const unwantedCount = dto.boundingBoxes.filter((b) => b.classId === 2).length;
    const totalCount = dto.boundingBoxes.length;
    const saltCount = pureCount + impureCount;
    const purityPercentage = saltCount > 0 ? (pureCount / saltCount) * 100 : 100;

    const detection = new this.detectionModel({
      frameWidth: dto.frameWidth,
      frameHeight: dto.frameHeight,
      processingTimeMs: dto.processingTimeMs,
      pureCount,
      impureCount,
      unwantedCount,
      totalCount,
      purityPercentage,
      sessionId: dto.sessionId ? new Types.ObjectId(dto.sessionId) : null,
      batchId: dto.batchId ? new Types.ObjectId(dto.batchId) : null,
      roiPureCount: dto.roiPureCount ?? 0,
      roiImpureCount: dto.roiImpureCount ?? 0,
      roiUnwantedCount: dto.roiUnwantedCount ?? 0,
      roiTotalCount: dto.roiTotalCount ?? 0,
      roiPurityPercentage: dto.roiPurityPercentage,
      avgWhiteness: dto.avgWhiteness,
      avgQualityScore: dto.avgQualityScore,
      roiAvgWhiteness: dto.roiAvgWhiteness,
      roiAvgQualityScore: dto.roiAvgQualityScore,
      boundingBoxes: dto.boundingBoxes.map((box) => ({
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

    return detection.save();
  }

  async findAll(filter: DetectionFilter) {
    const { page = 1, limit = 20, startDate, endDate, minPurity, maxPurity, sessionId } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.$gte = new Date(startDate);
      if (endDate) where.timestamp.$lte = new Date(endDate);
    }

    if (minPurity !== undefined || maxPurity !== undefined) {
      where.purityPercentage = {};
      if (minPurity !== undefined) where.purityPercentage.$gte = minPurity;
      if (maxPurity !== undefined) where.purityPercentage.$lte = maxPurity;
    }

    if (sessionId) {
      where.sessionId = new Types.ObjectId(sessionId);
    }

    const [data, total] = await Promise.all([
      this.detectionModel
        .find(where)
        .skip(skip)
        .limit(limit)
        .sort({ timestamp: -1 })
        .exec(),
      this.detectionModel.countDocuments(where).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<DetectionDocument> {
    const detection = await this.detectionModel.findById(id).exec();
    if (!detection) {
      throw new NotFoundException(`Detection with ID ${id} not found`);
    }
    return detection;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.detectionModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Detection with ID ${id} not found`);
    }
    return { success: true };
  }

  async incrementSessionStats(
    sessionId: string,
    roiPureCount: number,
    roiImpureCount: number,
    roiUnwantedCount: number,
  ): Promise<void> {
    await this.sessionModel.findByIdAndUpdate(sessionId, {
      $inc: {
        totalFrames: 1,
        totalPureCount: roiPureCount,
        totalImpureCount: roiImpureCount,
        totalUnwantedCount: roiUnwantedCount,
      },
    }).exec();
  }
}
