import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class DailyMeasurement extends Document {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: false, default: null })
  waterTemperature: number;

  @Prop({ required: true })
  lagoon: number;

  @Prop({ required: false, default: 0 })
  orBrineLevel: number;

  @Prop({ required: false, default: 0 })
  orBoundLevel: number;

  @Prop({ required: false, default: 0 })
  irBrineLevel: number;

  @Prop({ required: false, default: 0 })
  irBoundLevel: number;

  @Prop({ required: false, default: 0 })
  eastChannel: number;

  @Prop({ required: false, default: 0 })
  westChannel: number;

  // Mongoose timestamps - automatically managed by Mongoose
  createdAt?: Date;
  updatedAt?: Date;
}

export const DailyMeasurementSchema = SchemaFactory.createForClass(DailyMeasurement);