import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class DemandData {
  @Prop({ required: true })
  month: string;

  @Prop({ required: true })
  demandTons: number;

  @Prop({ required: true })
  isPrediction: boolean;

  @Prop({ required: false })
  trend?: string; // "increasing|stable|decreasing"
}

@Schema({ timestamps: true })
export class DemandPrediction extends Document {
  @Prop({ required: true })
  region: string;

  @Prop({ required: true })
  productType: string;

  @Prop({ type: [DemandData], required: true })
  predictions: DemandData[];

  @Prop({ type: [DemandData], required: true })
  historicalData: DemandData[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const DemandPredictionSchema = SchemaFactory.createForClass(DemandPrediction);
