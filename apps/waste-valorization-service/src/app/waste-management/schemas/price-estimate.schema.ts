import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'price_estimates', timestamps: true })
export class PriceEstimate extends Document {
  @Prop({ type: String, required: false })
  site_id?: string;

  @Prop({ type: String, required: false })
  user_id?: string;

  @Prop({ type: Number, required: false })
  epsom_salt?: number;

  @Prop({ type: Number, required: false })
  potash?: number;

  @Prop({ type: Number, required: false })
  magnesium_oil?: number;

  @Prop({ type: Number, required: false })
  gypsum?: number;

  @Prop({ type: Number, required: false })
  limestone?: number;

  @Prop({ type: Number, required: false })
  industrial_salt?: number;

  @Prop({ type: String, required: false })
  currency?: string;
}

export const PriceEstimateSchema = SchemaFactory.createForClass(PriceEstimate);
