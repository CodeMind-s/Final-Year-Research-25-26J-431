import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BatchService, BatchSummary } from './batch.service';

@Controller()
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @GrpcMethod('VisionService', 'CreateBatch')
  async createBatch(data: {
    sessionId: string;
    roi?: { x: number; y: number; width: number; height: number };
    user_id?: string;
  }) {
    const roi = data.roi && data.roi.width > 0
      ? data.roi
      : { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

    const batch = await this.batchService.createBatch(data.sessionId, roi, data.user_id);
    return this.toBatchResponse(batch);
  }

  @GrpcMethod('VisionService', 'EndBatch')
  async endBatch(data: { batchId: string }) {
    const batch = await this.batchService.endBatch(data.batchId);
    return this.toBatchResponse(batch);
  }

  @GrpcMethod('VisionService', 'GetBatch')
  async getBatch(data: { batchId: string }) {
    const batch = await this.batchService.getBatch(data.batchId);
    if (!batch) {
      throw new Error(`Batch ${data.batchId} not found`);
    }
    return this.toBatchResponse(batch);
  }

  @GrpcMethod('VisionService', 'GetAllBatches')
  async getAllBatches(data: { page?: number; limit?: number; sessionId?: string; user_id?: string }) {
    const page = data.page && data.page > 0 ? data.page : 1;
    const limit = data.limit && data.limit > 0 ? data.limit : 20;
    const { batches, total } = await this.batchService.getAllBatches(page, limit, data.sessionId, data.user_id);
    return {
      batches: batches.map((b) => this.toBatchResponse(b)),
    };
  }

  @GrpcMethod('VisionService', 'GetSessionBatches')
  async getSessionBatches(data: { sessionId: string; user_id?: string }) {
    const batches = await this.batchService.getSessionBatches(data.sessionId, data.user_id);
    return {
      batches: batches.map((b) => this.toBatchResponse(b)),
    };
  }

  @GrpcMethod('VisionService', 'GetBatchTrends')
  async getBatchTrends(data: { sessionId: string; user_id?: string }) {
    const trends = await this.batchService.getBatchTrends(data.sessionId, data.user_id);
    return { trends };
  }

  private toBatchResponse(batch: BatchSummary) {
    return {
      id: batch.id,
      batchNumber: batch.batchNumber,
      startTime: batch.startTime.toISOString(),
      endTime: batch.endTime ? batch.endTime.toISOString() : '',
      pureCount: batch.pureCount,
      impureCount: batch.impureCount,
      unwantedCount: batch.unwantedCount,
      totalCount: batch.totalCount,
      purityPercentage: batch.purityPercentage ?? 0,
      frameCount: batch.frameCount,
      roi: batch.roi,
      avgWhiteness: batch.avgWhiteness ?? 0,
      avgQualityScore: batch.avgQualityScore ?? 0,
      sessionId: batch.sessionId,
      user_id: batch.userId || '',
    };
  }
}
