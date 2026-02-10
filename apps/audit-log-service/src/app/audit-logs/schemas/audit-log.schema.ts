import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: 'auditLogs' })
export class AuditLog {
  @Prop({ required: true })
  serviceName: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: false })
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

  @Prop({ required: false })
  method: string; // HTTP method (GET, POST, PUT, DELETE)

  @Prop({ required: false })
  path: string; // Request path

  @Prop({ required: false })
  statusCode: number; // HTTP status code

  @Prop({ required: false })
  duration: number; // Request duration in ms

  @Prop({ required: false })
  userAgent: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Add indexes for better query performance
AuditLogSchema.index({ serviceName: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ status: 1, createdAt: -1 });
AuditLogSchema.index({ method: 1, createdAt: -1 });
AuditLogSchema.index({ path: 1, createdAt: -1 });
