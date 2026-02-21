import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HarvestPlanModule } from './harvest-plan/harvest-plan.module';
import { DistributorOfferModule } from './distributor-offers/distributor-offer.module';
import { DealModule } from './deals/deal.module';

@Module({
  imports: [
    HarvestPlanModule,
    DistributorOfferModule,
    DealModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI ||
        'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0'
    ),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
