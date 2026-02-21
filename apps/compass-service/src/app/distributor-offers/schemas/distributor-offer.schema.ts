import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum OfferRequirement {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum OfferStatus {
  DRAFT = 'DRAFT',
  PUBLISH = 'PUBLISH',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class DistributorOffer extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  pricePerKilo: number;

  @Prop({ required: true })
  targetQuantity: number;

  @Prop({ default: 0 })
  collectedQuantity: number;

  @Prop({ required: true })
  totalInvestment: number;

  @Prop({ required: true, enum: OfferStatus, default: OfferStatus.DRAFT })
  status: OfferStatus;

  @Prop({ required: true, enum: OfferRequirement })
  requirement: OfferRequirement;

  // Mongoose timestamps - automatically managed
  createdAt?: Date;
  updatedAt?: Date;
}

export const DistributorOfferSchema = SchemaFactory.createForClass(DistributorOffer);
