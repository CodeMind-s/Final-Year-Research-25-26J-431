import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SellerProfile extends Document {
  @Prop({ required: true, unique: true })
  sellerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, default: 'Medium' })
  reliability: string; // "High|Medium|Low"

  @Prop({ required: true, default: 0 })
  totalPurchased: number;

  @Prop({ required: true, default: 0 })
  activeCampaigns: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SellerProfileSchema = SchemaFactory.createForClass(SellerProfile);
