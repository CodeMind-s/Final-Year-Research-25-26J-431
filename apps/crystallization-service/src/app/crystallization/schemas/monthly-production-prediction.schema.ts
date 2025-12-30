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

  @Prop({ type: Object, required: false })
  metadata?: {
    water_temperature?: number;
    lagoon?: number;
    OR_brine_level?: number;
    OR_bund_level?: number;
    IR_brine_level?: number;
    IR_bound_level?: number;
    East_channel?: number;
    West_channel?: number;
  };

  // Mongoose timestamps - automatically managed by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const MonthlyProductionPredictionSchema = SchemaFactory.createForClass(MonthlyProductionPrediction);
