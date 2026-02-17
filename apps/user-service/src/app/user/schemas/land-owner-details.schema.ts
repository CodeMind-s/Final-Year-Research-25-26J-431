import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class LandOwnerDetails extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  docUrls!: string[];

  @Prop({ required: true })
  totalBeds!: number;

  @Prop({ required: true })
  nic!: string;

  @Prop({ required: true })
  address!: string;
}

export const LandOwnerDetailsSchema = SchemaFactory.createForClass(LandOwnerDetails);
