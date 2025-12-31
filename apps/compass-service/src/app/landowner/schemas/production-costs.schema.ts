import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ProductionCosts extends Document {
  @Prop({ required: true })
  landownerId: string;

  @Prop({ required: true, default: 0 })
  fertilizerCost: number;

  @Prop({ required: true, default: 0 })
  laborCost: number;

  @Prop({ required: true, default: 0 })
  transportCost: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProductionCostsSchema = SchemaFactory.createForClass(ProductionCosts);
