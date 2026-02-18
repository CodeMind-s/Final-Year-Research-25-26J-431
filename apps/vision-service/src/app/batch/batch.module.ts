import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BatchService } from './batch.service';
import { BatchController } from './batch.controller';
import { Batch, BatchSchema } from '../detection/schemas/batch.schema';
import {
  DetectionSession,
  DetectionSessionSchema,
} from '../detection/schemas/detection-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Batch.name, schema: BatchSchema },
      { name: DetectionSession.name, schema: DetectionSessionSchema },
    ]),
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
