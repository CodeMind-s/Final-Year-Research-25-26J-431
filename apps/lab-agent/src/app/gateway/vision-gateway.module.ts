import { Module } from '@nestjs/common';
import { VisionGateway } from './vision.gateway';
import { InferenceModule } from '../inference/inference.module';
import { ROIModule } from '../roi/roi.module';
import { CloudSyncModule } from '../cloud-sync/cloud-sync.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [InferenceModule, ROIModule, CloudSyncModule, MetricsModule],
  providers: [VisionGateway],
})
export class VisionGatewayModule {}
