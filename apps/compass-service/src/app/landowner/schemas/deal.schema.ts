import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class DealAllocation {
  @Prop({ required: true })
  sellerId: string;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  pricePerTon: number;

  @Prop({ required: true })
  revenue: number;
}

@Schema({ _id: false })
export class Negotiation {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  timestamp: number;
}

@Schema({ timestamps: true })
export class Deal extends Document {
  @Prop({ required: true })
  sellerId: string;

  @Prop({ required: true })
  sellerName: string;

  @Prop({ required: true })
  landownerId: string;

  @Prop({ required: true })
  landownerName: string;

  @Prop({ type: [DealAllocation], required: true })
  allocations: DealAllocation[];

  @Prop({ required: true })
  totalQuantity: number;

  @Prop({ required: true })
  totalRevenue: number;

  @Prop({ required: true })
  productionCosts: number;

  @Prop({ required: true })
  netProfit: number;

  @Prop({ required: true })
  status: string; // "accepted|negotiating|completed|rejected"

  @Prop({ required: false })
  acceptedAt?: number;

  @Prop({ required: false })
  completedAt?: number;

  @Prop({ type: [Negotiation], default: [] })
  negotiations: Negotiation[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const DealSchema = SchemaFactory.createForClass(Deal);
