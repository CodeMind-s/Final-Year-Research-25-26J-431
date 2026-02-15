import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class PerformanceMetrics {
    @Prop({ required: true })
    test_mae: number;

    @Prop({ required: true })
    test_rmse: number;

    @Prop({ required: true })
    test_r2_score: number;

    @Prop({ required: true })
    test_accuracy: number;

    @Prop({ required: true })
    validation_r2_score: number;

    @Prop({ required: true })
    validation_accuracy: number;
}

@Schema({ timestamps: true })
export class CrystallizationModelPerformance extends Document {
    @Prop({ required: true })
    model_type: string;

    @Prop({ required: true })
    forecast_generated: Date;

    @Prop({ required: true, type: PerformanceMetrics })
    performance_metrics: PerformanceMetrics;

    // Mongoose timestamps - automatically managed by Mongoose
    createdAt?: Date;
    updatedAt?: Date;
}

export const CrystallizationModelPerformanceSchema = SchemaFactory.createForClass(CrystallizationModelPerformance);
