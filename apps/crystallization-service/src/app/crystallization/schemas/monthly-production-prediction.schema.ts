import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class MonthlyProductionPrediction extends Document {
  @Prop({ required: true, unique: true, index: true })
  month: string; // Format: YYYY-MM

  @Prop({ required: true })
  monthNumber: number;

  @Prop({ required: true })
  productionForecast: number;

  @Prop({ required: true })
  lowerBound: number;

  @Prop({ required: true })
  upperBound: number;

  @Prop({ required: true })
  season: string;

  // Mongoose timestamps - automatically managed by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const MonthlyProductionPredictionSchema = SchemaFactory.createForClass(MonthlyProductionPrediction);
