import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WasteManagementController } from './waste-management.controller';
import { WasteManagementService } from './waste-management.service';
import {
  WastePrediction,
  WastePredictionSchema,
} from './schemas/waste-prediction.schema';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WastePrediction.name, schema: WastePredictionSchema },
    ]),
    JobsModule,
  ],
  controllers: [WasteManagementController],
  providers: [WasteManagementService],
  exports: [WasteManagementService],
})
export class WasteManagementModule {}
