import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class SellerRecommendationData {
  @Prop({ required: true })
  seller_id: number;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  confidence: number;

  @Prop({ required: true })
  confidence_percentage: string;

  @Prop({ required: true })
  ranking: number; // 1, 2, or 3
}

@Schema({ timestamps: true })
export class SellerRecommendation extends Document {
  @Prop({ required: true })
  landownerId: string;

  @Prop({ required: true })
  availableTons: number;

  @Prop({ required: true })
  region: string;

  @Prop({ type: [SellerRecommendationData], required: true })
  recommendations: SellerRecommendationData[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const SellerRecommendationSchema = SchemaFactory.createForClass(SellerRecommendation);
