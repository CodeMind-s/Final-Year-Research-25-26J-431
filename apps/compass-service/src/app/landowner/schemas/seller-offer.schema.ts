import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SellerOffer extends Document {
  @Prop({ required: true })
  sellerId: string;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  pricePerTon: number;

  @Prop({ required: true })
  demandTons: number;

  @Prop({ required: true })
  reliability: string; // "High|Medium|Low"

  @Prop({ required: true, default: false })
  isRecommended: boolean;

  @Prop({ required: true })
  timestamp: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SellerOfferSchema = SchemaFactory.createForClass(SellerOffer);
