import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  BoundingBoxSubdoc,
  BoundingBoxSubdocSchema,
} from './bounding-box.schema';

export type DetectionDocument = HydratedDocument<Detection>;

@Schema({ timestamps: false, collection: 'vision_detections' })
export class Detection {
  @Prop({ default: () => new Date() })
  timestamp: Date;

  @Prop({ required: true })
  frameWidth: number;

  @Prop({ required: true })
  frameHeight: number;

  @Prop({ required: true })
  processingTimeMs: number;

  @Prop({ required: true })
  pureCount: number;

  @Prop({ required: true })
  impureCount: number;

  @Prop({ default: 0 })
  unwantedCount: number;

  @Prop({ required: true })
  totalCount: number;

  @Prop({ required: true })
  purityPercentage: number;

  @Prop({ default: 0 })
  roiPureCount: number;

  @Prop({ default: 0 })
  roiImpureCount: number;

  @Prop({ default: 0 })
  roiUnwantedCount: number;

  @Prop({ default: 0 })
  roiTotalCount: number;

  @Prop()
  roiPurityPercentage?: number;

  @Prop()
  avgWhiteness?: number;

  @Prop()
  avgQualityScore?: number;

  @Prop()
  roiAvgWhiteness?: number;

  @Prop()
  roiAvgQualityScore?: number;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DetectionSession', default: null })
  sessionId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Batch', default: null })
  batchId: Types.ObjectId | null;

  @Prop({ type: [BoundingBoxSubdocSchema], default: [] })
  boundingBoxes: BoundingBoxSubdoc[];
}

export const DetectionSchema = SchemaFactory.createForClass(Detection);

DetectionSchema.index({ timestamp: -1 });
DetectionSchema.index({ sessionId: 1 });
DetectionSchema.index({ batchId: 1 });
DetectionSchema.index({ purityPercentage: 1 });
