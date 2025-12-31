import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class LandownerProfile extends Document {
  @Prop({ required: true, unique: true })
  landownerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, default: 0 })
  totalProductionTons: number;

  @Prop({ required: true, default: 0 })
  availableTons: number;

  @Prop({ required: true, default: 0 })
  soldTons: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const LandownerProfileSchema = SchemaFactory.createForClass(LandownerProfile);
