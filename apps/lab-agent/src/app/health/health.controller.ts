import { Controller, Get } from '@nestjs/common';
import { InferenceService } from '../inference/inference.service';
import { CloudSyncQueueService } from '../cloud-sync/cloud-sync-queue.service';
import { MetricsService } from '../metrics/metrics.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly inferenceService: InferenceService,
    private readonly cloudSyncQueue: CloudSyncQueueService,
    private readonly metrics: MetricsService,
  ) {}

  @Get()
  check() {
    const status = this.inferenceService.getModelStatus();
    return {
      status: 'ok',
      model: status.loaded,
      modelPath: status.path,
      version: process.env.LAB_AGENT_VERSION || '1.0.0',
      cloudSync: this.cloudSyncQueue.stats(),
      metrics: this.metrics.snapshot(),
    };
  }
}
