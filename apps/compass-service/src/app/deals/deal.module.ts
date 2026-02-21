import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { Deal, DealSchema } from './schemas/deal.schema';
import { DistributorOfferModule } from '../distributor-offers/distributor-offer.module';
import { DistributorOffer, DistributorOfferSchema } from '../distributor-offers/schemas/distributor-offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Deal.name, schema: DealSchema },
      { name: DistributorOffer.name, schema: DistributorOfferSchema },
    ]),
    DistributorOfferModule,
  ],
  controllers: [DealController],
  providers: [DealService],
  exports: [DealService],
})
export class DealModule {}
