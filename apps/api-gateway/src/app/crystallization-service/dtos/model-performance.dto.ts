import { ApiProperty } from '@nestjs/swagger';

export class GetModelPerformanceResponseDto {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty({ example: 'Model performance records fetched successfully' })
    message: string;

    @ApiProperty({
        example: [
            {
                _id: '677c1234567890abcdef1234',
                model_type: 'LSTM_Hybrid_with_Weather',
                forecast_generated: '2026-01-01T10:00:55.000Z',
                performance_metrics: {
                    test_mae: 0.22643738985061646,
                    test_rmse: 0.36510669291987724,
                    test_r2_score: 0.7749716637562971,
                    test_accuracy: 77.49716637562972,
                    validation_r2_score: 0.8884437289486968,
                    validation_accuracy: 88.84437289486968,
                },
                confidence: {
                    overallScore: 80,
                    overallRating: 'HIGH CONFIDENCE',
                    yieldRatio: 0.4587161659782055,
                    yieldStatus: 'LOW',
                    decliningTrend: true,
                    improvingTrend: false,
                    formulaR2: 0.973216,
                    holdoutMae: 7956,
                    nHistoryMonths: 4,
                    formulaFitScore: 97.3216,
                    holdoutScore: 92.044,
                    dataVolumeScore: 60,
                    yieldScore: 20,
                    bedCountTier: 'FACILITY',
                    bedCountNote: '',
                    date: '2026-03-07T00:00:00.000Z',
                },
                createdAt: '2026-01-01T04:47:00.000Z',
                updatedAt: '2026-01-01T04:47:00.000Z',
            },
        ],
    })
    data?: any[];
}
