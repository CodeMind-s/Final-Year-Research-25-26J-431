import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { Detection, DetectionSchema } from '../detection/schemas/detection.schema';
import { Batch, BatchSchema } from '../detection/schemas/batch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Detection.name, schema: DetectionSchema },
      { name: Batch.name, schema: BatchSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
