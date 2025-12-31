import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class PriceData {
  @Prop({ required: true })
  month: string;

  @Prop({ required: true })
  avgPrice: number;

  @Prop({ required: true })
  minPrice: number;

  @Prop({ required: true })
  maxPrice: number;

  @Prop({ required: true })
  isPrediction: boolean;
}

@Schema({ timestamps: true })
export class PricePrediction extends Document {
  @Prop({ required: true })
  region: string;

  @Prop({ type: [PriceData], required: true })
  predictions: PriceData[];

  @Prop({ type: [PriceData], required: true })
  historicalData: PriceData[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const PricePredictionSchema = SchemaFactory.createForClass(PricePrediction);
