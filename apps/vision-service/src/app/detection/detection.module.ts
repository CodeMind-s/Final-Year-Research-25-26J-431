import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DetectionService } from './detection.service';
import { DetectionController } from './detection.controller';
import { Detection, DetectionSchema } from './schemas/detection.schema';
import {
  DetectionSession,
  DetectionSessionSchema,
} from './schemas/detection-session.schema';
import { Batch, BatchSchema } from './schemas/batch.schema';
import { InferenceModule } from '../inference/inference.module';
import { ROIModule } from '../roi/roi.module';
import { BatchModule } from '../batch/batch.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Detection.name, schema: DetectionSchema },
      { name: DetectionSession.name, schema: DetectionSessionSchema },
      { name: Batch.name, schema: BatchSchema },
    ]),
    InferenceModule,
    ROIModule,
    BatchModule,
  ],
  controllers: [DetectionController],
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
