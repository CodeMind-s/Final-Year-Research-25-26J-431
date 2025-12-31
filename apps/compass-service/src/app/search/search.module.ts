import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { SellerProfile, SellerProfileSchema } from '../seller/schemas/seller-profile.schema';
import { SellerOfferModel, SellerOfferModelSchema } from '../seller/schemas/seller-offer.schema';
import { LandownerProfile, LandownerProfileSchema } from '../landowner/schemas/landowner-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SellerProfile.name, schema: SellerProfileSchema },
      { name: SellerOfferModel.name, schema: SellerOfferModelSchema },
      { name: LandownerProfile.name, schema: LandownerProfileSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
