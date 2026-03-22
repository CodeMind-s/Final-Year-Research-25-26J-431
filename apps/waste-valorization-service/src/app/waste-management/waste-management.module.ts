import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WasteManagementController } from './waste-management.controller';
import { WasteManagementService } from './waste-management.service';
import {
  WastePrediction,
  WastePredictionSchema,
} from './schemas/waste-prediction.schema';
import { PriceEstimate, PriceEstimateSchema } from './schemas/price-estimate.schema';
import { PriceEstimateService } from './price-estimate.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WastePrediction.name, schema: WastePredictionSchema },
      { name: PriceEstimate.name, schema: PriceEstimateSchema },
    ]),
    JobsModule,
  ],
  controllers: [WasteManagementController],
  providers: [WasteManagementService, PriceEstimateService],
  exports: [WasteManagementService],
})
export class WasteManagementModule {}
