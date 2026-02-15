import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { Detection, DetectionSchema } from '../detection/schemas/detection.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Detection.name, schema: DetectionSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
