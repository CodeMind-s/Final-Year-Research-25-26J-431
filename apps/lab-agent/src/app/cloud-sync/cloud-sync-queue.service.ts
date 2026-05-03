import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CloudSyncService } from './cloud-sync.service';
import { SaveDetectionBody } from './cloud-sync.types';

interface QueuedDetection {
  token: string;
  body: SaveDetectionBody;
  attempts: number;
  enqueuedAt: number;
}

const BASE_INTERVAL_MS = 2000;
const MAX_INTERVAL_MS = 30000;

@Injectable()
export class CloudSyncQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(CloudSyncQueueService.name);
  private readonly maxLength: number;
  private readonly queue: QueuedDetection[] = [];
  private currentInterval = BASE_INTERVAL_MS;
  private timer: NodeJS.Timeout | null = null;
  private droppedOnOverflow = 0;
  private permanentFailures = 0;

  constructor(private readonly cloudSync: CloudSyncService) {
    this.maxLength = parseInt(process.env.CLOUD_SYNC_QUEUE_MAX || '500', 10);
    this.scheduleNext();
  }

  enqueue(token: string, body: SaveDetectionBody): void {
    if (this.queue.length >= this.maxLength) {
      this.queue.shift();
      this.droppedOnOverflow += 1;
      if (this.droppedOnOverflow % 50 === 1) {
        this.logger.warn(
          `Detection queue overflow — dropped oldest (total dropped: ${this.droppedOnOverflow})`,
        );
      }
    }
    this.queue.push({ token, body, attempts: 0, enqueuedAt: Date.now() });
  }

  // Synchronous send first; on transient failure stash in queue. Errors are
  // never surfaced to the caller — saveDetection is fire-and-forget by design.
  async sendOrQueue(token: string, body: SaveDetectionBody): Promise<void> {
    try {
      await this.cloudSync.saveDetection(token, body);
    } catch (err) {
      if (this.cloudSync.isTransient(err)) {
        this.enqueue(token, body);
      } else {
        this.permanentFailures += 1;
        this.logger.warn(
          `Detection rejected by cloud (non-retriable): ${(err as Error).message}`,
        );
      }
    }
  }

  size(): number {
    return this.queue.length;
  }

  stats() {
    return {
      pending: this.queue.length,
      droppedOnOverflow: this.droppedOnOverflow,
      permanentFailures: this.permanentFailures,
      currentIntervalMs: this.currentInterval,
    };
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext() {
    this.timer = setTimeout(() => this.drain().catch(() => undefined), this.currentInterval);
    this.timer.unref?.();
  }

  private async drain(): Promise<void> {
    if (this.queue.length === 0) {
      this.currentInterval = BASE_INTERVAL_MS;
      this.scheduleNext();
      return;
    }

    const item = this.queue[0];
    try {
      await this.cloudSync.saveDetection(item.token, item.body);
      this.queue.shift();
      this.currentInterval = BASE_INTERVAL_MS;
    } catch (err) {
      if (this.cloudSync.isTransient(err)) {
        item.attempts += 1;
        this.currentInterval = Math.min(this.currentInterval * 2, MAX_INTERVAL_MS);
      } else {
        // Non-retriable — drop and keep draining the rest at the base rate.
        this.queue.shift();
        this.permanentFailures += 1;
      }
    } finally {
      this.scheduleNext();
    }
  }
}
