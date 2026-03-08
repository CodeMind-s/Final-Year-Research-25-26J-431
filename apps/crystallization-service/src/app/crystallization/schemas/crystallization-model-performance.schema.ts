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

class ConfidenceData {
    @Prop({ required: true })
    overallScore: number;

    @Prop({ required: true })
    overallRating: string;

    @Prop({ required: true })
    yieldRatio: number;

    @Prop({ required: true })
    yieldStatus: string;

    @Prop({ required: true })
    decliningTrend: boolean;

    @Prop({ required: true })
    improvingTrend: boolean;

    @Prop({ required: true })
    formulaR2: number;

    @Prop({ required: true })
    holdoutMae: number;

    @Prop({ required: true })
    nHistoryMonths: number;

    @Prop({ required: true })
    formulaFitScore: number;

    @Prop({ required: true })
    holdoutScore: number;

    @Prop({ required: true })
    dataVolumeScore: number;

    @Prop({ required: true })
    yieldScore: number;

    @Prop()
    bedCountTier?: string;

    @Prop()
    bedCountNote?: string;

    @Prop({ required: true })
    date: Date;
}

@Schema({ timestamps: true })
export class CrystallizationModelPerformance extends Document {
    @Prop({ required: true })
    model_type: string;

    @Prop({ required: true })
    forecast_generated: Date;

    @Prop({ required: true, type: PerformanceMetrics })
    performance_metrics: PerformanceMetrics;

    @Prop({ required: true, type: ConfidenceData })
    confidence: ConfidenceData;

    // Mongoose timestamps - automatically managed by Mongoose
    createdAt?: Date;
    updatedAt?: Date;
}

export const CrystallizationModelPerformanceSchema = SchemaFactory.createForClass(CrystallizationModelPerformance);
