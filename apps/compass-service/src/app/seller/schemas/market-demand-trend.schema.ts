import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class DemandTrendData {
  @Prop({ required: true })
  month: string;

  @Prop({ required: true })
  demand: number;
}

@Schema({ timestamps: true })
export class MarketDemandTrend extends Document {
  @Prop({ required: true })
  region: string;

  @Prop({ type: [DemandTrendData], required: true })
  trends: DemandTrendData[];

  @Prop({ required: true })
  currentDemand: number;

  @Prop({ required: true })
  trend: string; // "up|down|stable"

  createdAt?: Date;
  updatedAt?: Date;
}

export const MarketDemandTrendSchema = SchemaFactory.createForClass(MarketDemandTrend);
