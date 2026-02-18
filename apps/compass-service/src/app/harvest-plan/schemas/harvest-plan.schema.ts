import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum HarvestStatus {
  FRESHER = 'FRESHER',
  MIDLEVEL = 'MIDLEVEL',
  HARVESTED = 'HARVESTED',
  DISPOSED = 'DISPOSED',
}

@Schema({ timestamps: true })
export class HarvestPlan extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  saltBeds: number;

  @Prop({ required: true, enum: HarvestStatus, default: HarvestStatus.FRESHER })
  harvestStatus: HarvestStatus;

  @Prop({ required: true })
  planPeriod: number;

  @Prop({ required: true, type: Date })
  startDate: Date;

  @Prop({ required: true, type: Date })
  endDate: Date;

  @Prop({ default: 0 })
  predictedProduction: number;

  @Prop({ default: 0 })
  actualProduction: number;

  @Prop({ default: 0 })
  workerCount: number;

  @Prop({ default: 0 })
  predictedProfit: number;

  @Prop({ default: 0 })
  actualProfit: number;

  @Prop({ default: 0 })
  expenses: number;

  @Prop({ default: 0 })
  earnings: number;

  @Prop({ default: 0 })
  avgSellingPrice: number;

  // Mongoose timestamps - automatically managed
  createdAt?: Date;
  updatedAt?: Date;
}

export const HarvestPlanSchema = SchemaFactory.createForClass(HarvestPlan);
