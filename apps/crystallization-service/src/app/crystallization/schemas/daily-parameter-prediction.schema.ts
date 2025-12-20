import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class Parameters {
  @Prop({ required: true })
  water_temperature: number;

  @Prop({ required: true })
  lagoon: number;

  @Prop({ required: true })
  OR_brine_level: number;

  @Prop({ required: true })
  OR_bund_level: number;

  @Prop({ required: true })
  IR_brine_level: number;

  @Prop({ required: true })
  IR_bound_level: number;

  @Prop({ required: true })
  East_channel: number;

  @Prop({ required: true })
  West_channel: number;
}

class Weather {
  @Prop({ required: true })
  temperature_mean: number;

  @Prop({ required: true })
  temperature_min: number;

  @Prop({ required: true })
  temperature_max: number;

  @Prop({ required: true })
  rain_sum: number;

  @Prop({ required: true })
  wind_speed_max: number;

  @Prop({ required: true })
  wind_gusts_max: number;

  @Prop({ required: true })
  relative_humidity_mean: number;
}

@Schema({ timestamps: true })
export class DailyParameterPrediction extends Document {
  @Prop({ required: true, unique: true, index: true })
  date: string; // Format: YYYY-MM-DD

  @Prop({ required: true })
  dayNumber: number;

  @Prop({ required: true, type: Parameters })
  parameters: Parameters;

  @Prop({ required: true, type: Weather })
  weather: Weather;

  // Mongoose timestamps - automatically managed by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const DailyParameterPredictionSchema = SchemaFactory.createForClass(DailyParameterPrediction);
