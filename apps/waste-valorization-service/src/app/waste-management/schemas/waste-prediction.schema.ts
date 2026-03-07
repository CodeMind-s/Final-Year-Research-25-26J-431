import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'waste_prediction', timestamps: false })
export class WastePrediction extends Document {
  @Prop({ required: true, type: Date })
  timestamp: Date;

  @Prop({ required: true, type: String })
  prediction_date: string;

  @Prop({
    required: true,
    type: {
      production_volume: Number,
      rain_sum: Number,
      temperature_mean: Number,
      humidity_mean: Number,
      wind_speed_mean: Number,
      month: Number,
    },
  })
  input_parameters: {
    production_volume: number;
    rain_sum: number;
    temperature_mean: number;
    humidity_mean: number;
    wind_speed_mean: number;
    month: number;
  };

  @Prop({
    required: true,
    type: {
      Total_Waste_kg: Number,
      Solid_Waste_Limestone_kg: Number,
      Solid_Waste_Gypsum_kg: Number,
      Solid_Waste_Industrial_Salt_kg: Number,
      Liquid_Waste_Bittern_Liters: Number,
      Potential_Epsom_Salt_kg: Number,
      Potential_Potash_kg: Number,
      Potential_Magnesium_Oil_Liters: Number,
    },
  })
  prediction_result: {
    Total_Waste_kg: number;
    Solid_Waste_Limestone_kg: number;
    Solid_Waste_Gypsum_kg: number;
    Solid_Waste_Industrial_Salt_kg: number;
    Liquid_Waste_Bittern_Liters: number;
    Potential_Epsom_Salt_kg: number;
    Potential_Potash_kg: number;
    Potential_Magnesium_Oil_Liters: number;
  };

  @Prop({
    type: {
      event_type: String,
      processor_version: String,
      request_id: String,
    },
  })
  metadata: {
    event_type: string;
    processor_version: string;
    request_id: string;
  };
}

export const WastePredictionSchema = SchemaFactory.createForClass(WastePrediction);
