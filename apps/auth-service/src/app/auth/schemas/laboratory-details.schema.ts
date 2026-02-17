import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class LaboratoryDetails extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  docUrls!: string[];

  @Prop({ required: true })
  laboratoryName!: string;

  @Prop({ required: true })
  registrationNumber!: string;

  @Prop({ required: true })
  address!: string;
}

export const LaboratoryDetailsSchema = SchemaFactory.createForClass(LaboratoryDetails);
