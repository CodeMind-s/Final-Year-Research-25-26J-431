import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Plan extends Document {
  @Prop({ unique: true, required: true })
  key: string; // 'free' | 'pro' | 'lab'

  @Prop({ required: true })
  name: string; // 'Free Plan' | 'Pro Plan' | 'Lab Plan'

  @Prop({ required: true })
  level: number; // 0 | 1 | 2

  @Prop({ type: Number, default: 0 })
  priceMonthlyLKR: number;

  @Prop({ type: Number, default: 0 })
  priceAnnualLKR: number;

  @Prop({ type: [String], default: [] })
  featureKeys: string[];

  @Prop({ default: 'monthly' })
  duration: string; // 'monthly' | 'annual' | 'lifetime'

  @Prop({ default: true })
  isActive: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
