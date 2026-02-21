import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum DealStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
  CANCELED = 'CANCELED',
}

@Schema({ timestamps: true })
export class Deal extends Document {
  @Prop({ required: true })
  landownerId: string;

  @Prop({ required: true })
  distributorId: string;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'DistributorOffer' })
  offerId: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  pricePerKilo: number;

  @Prop({ required: true, enum: DealStatus, default: DealStatus.DRAFT })
  status: DealStatus;

  @Prop({ type: Date })
  acceptedAt?: Date;

  // Mongoose timestamps - automatically managed
  createdAt?: Date;
  updatedAt?: Date;
}

export const DealSchema = SchemaFactory.createForClass(Deal);
