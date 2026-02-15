import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class BoundingBoxSubdoc {
  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;

  @Prop({ required: true })
  width: number;

  @Prop({ required: true })
  height: number;

  @Prop({ required: true })
  classId: number;

  @Prop({ required: true })
  className: string;

  @Prop({ required: true })
  confidence: number;

  @Prop()
  whitenessPercentage?: number;

  @Prop()
  qualityScore?: number;
}

export const BoundingBoxSubdocSchema =
  SchemaFactory.createForClass(BoundingBoxSubdoc);
