import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { InferenceModule } from '../inference/inference.module';

@Module({
  imports: [InferenceModule],
  controllers: [HealthController],
})
export class HealthModule {}
