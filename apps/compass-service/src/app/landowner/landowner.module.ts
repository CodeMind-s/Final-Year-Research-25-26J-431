import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { LandownerController } from './landowner.controller';
import { LandownerService } from './landowner.service';
import {
  LandownerProfile,
  LandownerProfileSchema,
} from './schemas/landowner-profile.schema';
import {
  ProductionCosts,
  ProductionCostsSchema,
} from './schemas/production-costs.schema';
import {
  PricePrediction,
  PricePredictionSchema,
} from './schemas/price-prediction.schema';
import {
  DemandPrediction,
  DemandPredictionSchema,
} from './schemas/demand-prediction.schema';
import {
  SellerRecommendation,
  SellerRecommendationSchema,
} from './schemas/seller-recommendation.schema';
import {
  SellerOffer,
  SellerOfferSchema,
} from './schemas/seller-offer.schema';
import { Deal, DealSchema } from './schemas/deal.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forFeature([
      { name: LandownerProfile.name, schema: LandownerProfileSchema },
      { name: ProductionCosts.name, schema: ProductionCostsSchema },
      { name: PricePrediction.name, schema: PricePredictionSchema },
      { name: DemandPrediction.name, schema: DemandPredictionSchema },
      { name: SellerRecommendation.name, schema: SellerRecommendationSchema },
      { name: SellerOffer.name, schema: SellerOfferSchema },
      { name: Deal.name, schema: DealSchema },
    ]),
  ],
  controllers: [LandownerController],
  providers: [LandownerService],
  exports: [LandownerService],
})
export class LandownerModule {}
