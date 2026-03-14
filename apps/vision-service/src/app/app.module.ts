import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { InferenceModule } from './inference/inference.module';
import { DetectionModule } from './detection/detection.module';
import { BatchModule } from './batch/batch.module';
import { StatisticsModule } from './statistics/statistics.module';
import { HealthModule } from './health/health.module';
import { ROIModule } from './roi/roi.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGO_URI ||
        'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0',
    ),
    InferenceModule,
    DetectionModule,
    BatchModule,
    StatisticsModule,
    HealthModule,
    ROIModule,
  ],
})
export class AppModule {}
