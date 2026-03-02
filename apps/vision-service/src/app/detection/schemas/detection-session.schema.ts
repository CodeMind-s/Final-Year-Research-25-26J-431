import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DetectionSessionDocument = HydratedDocument<DetectionSession>;

@Schema({ _id: false })
class ROISubdoc {
  @Prop({ default: 0.05 })
  x: number;

  @Prop({ default: 0.05 })
  y: number;

  @Prop({ default: 0.9 })
  width: number;

  @Prop({ default: 0.9 })
  height: number;
}

const ROISubdocSchema = SchemaFactory.createForClass(ROISubdoc);

@Schema({ timestamps: false, collection: 'vision_sessions' })
export class DetectionSession {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: () => new Date() })
  startTime: Date;

  @Prop({ type: Date, default: null })
  endTime: Date | null;

  @Prop({ default: 0 })
  totalFrames: number;

  @Prop({ default: 0 })
  totalPureCount: number;

  @Prop({ default: 0 })
  totalImpureCount: number;

  @Prop({ default: 0 })
  totalUnwantedCount: number;

  @Prop({ type: Number, default: null })
  avgPurityPercent: number | null;

  @Prop({ default: 0 })
  totalBatches: number;

  @Prop({ type: Number, default: null })
  avgWhiteness: number | null;

  @Prop({ type: Number, default: null })
  avgQualityScore: number | null;

  @Prop({ type: ROISubdocSchema, default: () => ({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 }) })
  roi: ROISubdoc;

  @Prop({ type: String, default: null })
  cameraSource: string | null;

  @Prop({ type: String, default: null })
  notes: string | null;
}

export const DetectionSessionSchema =
  SchemaFactory.createForClass(DetectionSession);

DetectionSessionSchema.index({ startTime: 1 });
