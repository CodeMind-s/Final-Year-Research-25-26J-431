import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ required: true })
  type: string; // "new_offer|deal_accepted|deal_completed|counter_offer"

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: false })
  dealId?: string;

  @Prop({ required: true })
  timestamp: number;

  @Prop({ required: true, default: false })
  read: boolean;

  @Prop({ required: true })
  recipientId: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
