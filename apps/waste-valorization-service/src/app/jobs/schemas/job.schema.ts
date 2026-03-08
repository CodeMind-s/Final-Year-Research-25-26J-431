import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum JobType {
  WASTE_PREDICTION = 'WASTE_PREDICTION',
  VALORIZATION_ANALYSIS = 'VALORIZATION_ANALYSIS',
  OPTIMIZATION = 'OPTIMIZATION',
}

@Schema({ timestamps: true })
export class Job extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, enum: JobType })
  jobType: JobType;

  @Prop({ required: true, enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Prop({ required: true, type: String })
  predictionDate: string;

  @Prop({ required: true, type: Object })
  requestData: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  resultData: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  errorMessage: string | null;

  // Optional metadata extracted from the request (e.g. request_id)
  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;
}

export const JobSchema = SchemaFactory.createForClass(Job);
