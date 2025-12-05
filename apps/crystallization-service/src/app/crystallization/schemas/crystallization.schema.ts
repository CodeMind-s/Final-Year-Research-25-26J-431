import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Log extends Document {
  @Prop({ required: true })
  logId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  lagoon: number;
}

export const LogSchema = SchemaFactory.createForClass(Log);