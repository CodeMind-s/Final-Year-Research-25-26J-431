import { Module } from '@nestjs/common';
import { InferenceModule } from './inference/inference.module';
import { ROIModule } from './roi/roi.module';
import { VisionGatewayModule } from './gateway/vision-gateway.module';
import { HealthModule } from './health/health.module';
import { CloudSyncModule } from './cloud-sync/cloud-sync.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [InferenceModule, ROIModule, MetricsModule, CloudSyncModule, VisionGatewayModule, HealthModule],
})
export class AppModule {}
