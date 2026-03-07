import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HarvestPlanController } from './harvest-plan.controller';
import { HarvestPlanService } from './harvest-plan.service';
import { HarvestPlan, HarvestPlanSchema } from './schemas/harvest-plan.schema';
import { DistributorOffer, DistributorOfferSchema } from '../distributor-offers/schemas/distributor-offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HarvestPlan.name, schema: HarvestPlanSchema },
      { name: DistributorOffer.name, schema: DistributorOfferSchema },
    ]),
  ],
  controllers: [HarvestPlanController],
  providers: [HarvestPlanService],
})
export class HarvestPlanModule {}
