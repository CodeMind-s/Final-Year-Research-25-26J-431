import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ActualMonthlyProduction extends Document {
  @Prop({ required: true, unique: true, index: true })
  month: string; // Format: YYYY-MM

  @Prop({ required: true })
  production_volume: number;

  @Prop({ required: true })
  season: string; // Maha or Yala

  createdAt?: Date;
  updatedAt?: Date;
}

export const ActualMonthlyProductionSchema = SchemaFactory.createForClass(ActualMonthlyProduction);
