import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DetectionService, CreateDetectionDto } from './detection.service';

@Injectable()
export class DetectionBufferService implements OnModuleDestroy {
  private readonly logger = new Logger(DetectionBufferService.name);
  private buffer: CreateDetectionDto[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 500;
  private readonly MAX_BUFFER_SIZE = 5;

  constructor(private readonly detectionService: DetectionService) {}

  add(dto: CreateDetectionDto): void {
    this.buffer.push(dto);

    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0);
    try {
      await this.detectionService.createMany(batch);
      this.logger.debug(`Flushed ${batch.length} detections to DB`);
    } catch (error) {
      this.logger.error(`Failed to flush detection buffer: ${error.message}`);
    }
  }

  onModuleDestroy() {
    this.flush();
  }
}
