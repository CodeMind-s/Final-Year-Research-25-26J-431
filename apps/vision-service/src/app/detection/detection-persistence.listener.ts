import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DetectionBufferService } from './detection-buffer.service';
import { DetectionService, CreateDetectionDto } from './detection.service';
import { BatchService } from '../batch/batch.service';

interface DetectionCreatedEvent {
  dto: CreateDetectionDto;
  sessionId?: string;
  batchId?: string;
  roiStats: {
    pureCount: number;
    impureCount: number;
    unwantedCount: number;
    totalCount: number;
  };
  roiWhitenessStats: {
    avgWhiteness: number;
    avgQualityScore: number;
  };
}

@Injectable()
export class DetectionPersistenceListener {
  private readonly logger = new Logger(DetectionPersistenceListener.name);

  constructor(
    private readonly detectionBufferService: DetectionBufferService,
    private readonly detectionService: DetectionService,
    private readonly batchService: BatchService,
  ) {}

  @OnEvent('detection.created', { async: true })
  async handleDetectionCreated(event: DetectionCreatedEvent): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      // Buffer detection for batch insert
      this.detectionBufferService.add(event.dto);

      // Increment session stats
      if (event.sessionId) {
        promises.push(
          this.detectionService.incrementSessionStats(
            event.sessionId,
            event.roiStats.pureCount,
            event.roiStats.impureCount,
            event.roiStats.unwantedCount,
          ),
        );
      }

      // Update batch snapshot
      if (event.batchId) {
        promises.push(
          this.batchService.setCurrentBatchSnapshot(
            event.batchId,
            event.roiStats.pureCount,
            event.roiStats.impureCount,
            event.roiStats.unwantedCount,
            event.roiStats.totalCount,
            event.roiWhitenessStats.avgWhiteness,
            event.roiWhitenessStats.avgQualityScore,
          ),
        );
      }

      await Promise.all(promises);
    } catch (error) {
      this.logger.error(`Failed to persist detection: ${error.message}`);
    }
  }
}
