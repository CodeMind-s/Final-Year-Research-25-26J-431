import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class Metadata {
  @Prop()
  water_temperature?: number;

  @Prop()
  lagoon?: number;

  @Prop()
  OR_brine_level?: number;

  @Prop()
  OR_bund_level?: number;

  @Prop()
  IR_brine_level?: number;

  @Prop()
  IR_bound_level?: number;

  @Prop()
  East_channel?: number;

  @Prop()
  West_channel?: number;
}

@Schema({ timestamps: true })
export class LandownerMonthlyProductionPrediction extends Document {
  @Prop({ required: true, index: true })
  landowner_id: string;

  @Prop({ required: true })
  month: string; // Format: YYYY-MM

  @Prop({ required: true })
  no_of_beds: number;

  @Prop({ required: true })
  productionForecast: number;

  @Prop({ required: true })
  lowerBound: number;

  @Prop({ required: true })
  upperBound: number;

  @Prop({ required: true })
  season: string;

  @Prop({ type: Metadata })
  metadata?: Metadata;

  // Mongoose timestamps - automatically managed by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const LandownerMonthlyProductionPredictionSchema = SchemaFactory.createForClass(LandownerMonthlyProductionPrediction);

// Create compound index for landowner_id and month
LandownerMonthlyProductionPredictionSchema.index({ landowner_id: 1, month: 1 }, { unique: true });
