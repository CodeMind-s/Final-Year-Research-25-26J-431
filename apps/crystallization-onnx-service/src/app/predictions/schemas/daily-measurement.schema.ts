import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class SensorParameters {
  @Prop({ required: true }) water_temperature: number;
  @Prop({ required: true }) lagoon: number;
  @Prop({ required: true }) OR_brine_level: number;
  @Prop({ required: true }) OR_bund_level: number;
  @Prop({ required: true }) IR_brine_level: number;
  @Prop({ required: true }) IR_bound_level: number;
  @Prop({ required: true }) East_channel: number;
  @Prop({ required: true }) West_channel: number;
}

@Schema({ timestamps: true })
export class DailyMeasurement extends Document {
  @Prop({ required: true }) date: Date;
  @Prop({ required: true }) dayNumber: number;
  @Prop({ required: true, type: SensorParameters }) parameters: SensorParameters;

  createdAt?: Date;
  updatedAt?: Date;
}

export const DailyMeasurementSchema = SchemaFactory.createForClass(DailyMeasurement);
