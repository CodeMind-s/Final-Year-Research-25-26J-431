import { Module } from '@nestjs/common';
import { ROIService } from './roi.service';

@Module({
  providers: [ROIService],
  exports: [ROIService],
})
export class ROIModule {}
