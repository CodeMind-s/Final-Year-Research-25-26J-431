import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { InferenceModule } from '../inference/inference.module';
import { CloudSyncModule } from '../cloud-sync/cloud-sync.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [InferenceModule, CloudSyncModule, MetricsModule],
  controllers: [HealthController],
})
export class HealthModule {}
