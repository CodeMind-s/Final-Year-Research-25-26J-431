import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema({ timestamps: true })
export class Log {
  @Prop({ required: true })
  serviceName: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: false })
  resourceId: string;

  @Prop({ required: false })
  resourceType: string;

  @Prop({ type: String, required: false })
  details: string; // JSON string for additional details

  @Prop({ required: true, default: 'success' })
  status: string; // success, error, warning

  @Prop({ required: false })
  ipAddress: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const LogSchema = SchemaFactory.createForClass(Log);

// Add indexes for better query performance
LogSchema.index({ serviceName: 1, createdAt: -1 });
LogSchema.index({ userId: 1, createdAt: -1 });
LogSchema.index({ action: 1, createdAt: -1 });
LogSchema.index({ status: 1, createdAt: -1 });
