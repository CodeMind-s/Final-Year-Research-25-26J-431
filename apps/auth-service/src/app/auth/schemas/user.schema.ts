import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop()
  password?: string;

  @Prop({ required: true })
  role!: string;

  @Prop({ default: false })
  isOnboarded!: boolean;

  @Prop({ enum: ['free', 'basic', 'premium'], default: 'free' })
  plan: string;

  @Prop({ default: false })
  isSubscribed: boolean;

  @Prop({ default: false })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);