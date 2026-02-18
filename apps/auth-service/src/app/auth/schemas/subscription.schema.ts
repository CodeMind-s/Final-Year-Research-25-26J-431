import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Plan', required: true })
  planId: Types.ObjectId;

  @Prop({ required: true })
  planKey: string; // Denormalized: 'free' | 'pro' | 'lab'

  @Prop({
    enum: ['active', 'inactive', 'expired', 'cancelled', 'trial'],
    default: 'active',
  })
  status: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: String, default: null })
  payHereSubscriptionId: string | null;

  @Prop({ type: String, default: null })
  payHereOrderId: string | null;

  @Prop({ default: false })
  isTrial: boolean;

  @Prop({ enum: ['payhere', 'manual', 'trial', 'free'], default: 'free' })
  paymentMethod: string;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
