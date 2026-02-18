import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HarvestPlanController } from './harvest-plan.controller';
import { HarvestPlanService } from './harvest-plan.service';
import { HarvestPlan, HarvestPlanSchema } from './schemas/harvest-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HarvestPlan.name, schema: HarvestPlanSchema },
    ]),
  ],
  controllers: [HarvestPlanController],
  providers: [HarvestPlanService],
})
export class HarvestPlanModule {}
