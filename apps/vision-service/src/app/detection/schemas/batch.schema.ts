import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BatchDocument = HydratedDocument<Batch>;

@Schema({ _id: false })
class ROISubdoc {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;
}

const ROISubdocSchema = SchemaFactory.createForClass(ROISubdoc);

@Schema({ timestamps: false, collection: 'vision_batches' })
export class Batch {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DetectionSession', required: true })
  sessionId: Types.ObjectId;

  @Prop({ required: true })
  batchNumber: number;

  @Prop({ default: () => new Date() })
  startTime: Date;

  @Prop({ type: Date, default: null })
  endTime: Date | null;

  @Prop({ type: ROISubdocSchema, required: true })
  roi: ROISubdoc;

  @Prop({ default: 0 })
  pureCount: number;

  @Prop({ default: 0 })
  impureCount: number;

  @Prop({ default: 0 })
  unwantedCount: number;

  @Prop({ default: 0 })
  totalCount: number;

  @Prop({ type: Number, default: null })
  purityPercentage: number | null;

  @Prop({ type: Number, default: null })
  avgWhiteness: number | null;

  @Prop({ type: Number, default: null })
  avgQualityScore: number | null;

  @Prop({ default: 0 })
  frameCount: number;
}

export const BatchSchema = SchemaFactory.createForClass(Batch);

BatchSchema.index({ sessionId: 1 });
BatchSchema.index({ startTime: 1 });
BatchSchema.index({ batchNumber: 1 });
