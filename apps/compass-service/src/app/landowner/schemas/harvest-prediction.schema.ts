import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class MonthPrediction {
  @Prop({ required: true })
  month: string;

  @Prop({ required: true })
  tons: number;

  @Prop({ required: true })
  isPrediction: boolean;

  @Prop({ required: false })
  confidence?: number;
}

@Schema({ timestamps: true })
export class HarvestPrediction extends Document {
  @Prop({ required: true })
  landownerId: string;

  @Prop({ type: [MonthPrediction], required: true })
  predictions: MonthPrediction[];

  @Prop({ type: [MonthPrediction], required: true })
  historicalData: MonthPrediction[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const HarvestPredictionSchema = SchemaFactory.createForClass(HarvestPrediction);
