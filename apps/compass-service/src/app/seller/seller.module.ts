import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';
import { SellerProfile, SellerProfileSchema } from './schemas/seller-profile.schema';
import { SellerOfferModel, SellerOfferModelSchema } from './schemas/seller-offer.schema';
import { MarketDemandTrend, MarketDemandTrendSchema } from './schemas/market-demand-trend.schema';
import { LandownerProfile, LandownerProfileSchema } from '../landowner/schemas/landowner-profile.schema';
import { Deal, DealSchema } from '../landowner/schemas/deal.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forFeature([
      { name: SellerProfile.name, schema: SellerProfileSchema },
      { name: SellerOfferModel.name, schema: SellerOfferModelSchema },
      { name: MarketDemandTrend.name, schema: MarketDemandTrendSchema },
      { name: LandownerProfile.name, schema: LandownerProfileSchema },
      { name: Deal.name, schema: DealSchema },
    ]),
  ],
  controllers: [SellerController],
  providers: [SellerService],
  exports: [SellerService],
})
export class SellerModule {}
