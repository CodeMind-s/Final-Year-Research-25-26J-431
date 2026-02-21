import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DistributorOfferController } from './distributor-offer.controller';
import { DistributorOfferService } from './distributor-offer.service';
import { DistributorOffer, DistributorOfferSchema } from './schemas/distributor-offer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DistributorOffer.name, schema: DistributorOfferSchema },
    ]),
  ],
  controllers: [DistributorOfferController],
  providers: [DistributorOfferService],
  exports: [DistributorOfferService],
})
export class DistributorOfferModule {}
