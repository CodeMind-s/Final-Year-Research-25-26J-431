import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SellerOfferModel extends Document {
  @Prop({ required: true })
  sellerId: string;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  pricePerTon: number;

  @Prop({ required: true })
  demandTons: number;

  @Prop({ required: true })
  reliability: string;

  @Prop({ required: true })
  timestamp: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SellerOfferModelSchema = SchemaFactory.createForClass(SellerOfferModel);
