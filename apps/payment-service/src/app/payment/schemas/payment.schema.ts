import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  orderId: string;

  @Prop({ required: true })
  planKey: string;

  @Prop({ required: true })
  billingCycle: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ default: 'LKR' })
  currency: string;

  @Prop({ enum: ['pending', 'success', 'failed', 'refunded', 'cancelled'], default: 'pending' })
  status: string;

  @Prop({ default: 'payhere' })
  paymentMethod: string;

  @Prop({ type: String, default: null })
  payHerePaymentId: string | null;

  @Prop({ type: String, default: null })
  payHereMd5Sig: string | null;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
