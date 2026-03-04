import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MlPredictorService } from './ml-predictor.service';
import { ProductionForecastService } from './production-forecast.service';
import { RetrainingService } from './retraining.service';
import { ActualMonthlyProduction } from './schemas/actual-monthly-production.schema';
import {
    PredictionRequest,
    PredictionResponse,
    DailyForecast,
    Weather,
    ProductionHistoryItem,
    RetrainingRequest,
    RetrainingResponse,
} from './dtos/interfaces';

/**
 * Service containing business logic for predictions.
 * ONNX model outputs 60 days × 8 parameters for daily forecasts.
 * Monthly/seasonal production uses the calibration formula from ProductionForecastService.
 */
@Injectable()
export class PredictionsService {
    private readonly logger = new Logger(PredictionsService.name);

    constructor(
        private readonly mlPredictor: MlPredictorService,
        private readonly productionForecastService: ProductionForecastService,
        private readonly retrainingService: RetrainingService,
        @InjectModel(ActualMonthlyProduction.name)
        private readonly actualMonthlyProductionModel: Model<ActualMonthlyProduction>,
    ) {}

    /**
     * Generate predictions based on current values and forecast days.
     * ONNX model is called ONCE and returns ALL 60 days of predictions.
     */
    async getPredictions(request: PredictionRequest): Promise<PredictionResponse> {
        if (!this.mlPredictor.isReady()) {
            throw new Error('Model not loaded. Please ensure the model file exists.');
        }

        const startDate    = this.parseDate(request.start_date);
        const forecastDays = Math.min(request.forecast_days, 60); // Model outputs max 60 days
        const currentValues = request.current_values;

        const currentParams = [
            currentValues.water_temperature,
            currentValues.lagoon,
            currentValues.OR_brine_level,
            currentValues.OR_bund_level,
            currentValues.IR_brine_level,
            currentValues.IR_bound_level,
            currentValues.East_channel,
            currentValues.West_channel,
        ];

        // Use || instead of ?? because protobuf defaults unset numbers to 0
        const lat = request.latitude || parseFloat(process.env.OPENWEATHER_LAT ?? '') || 7.2008;
        const lon = request.longitude || parseFloat(process.env.OPENWEATHER_LON ?? '') || 79.8737;

        this.logger.log(`Running ONNX inference for 60 days starting ${request.start_date}`);
        this.logger.log(`Location: lat=${lat}, lon=${lon}`);

        // ── SINGLE ONNX inference → 60 days of predictions ────────────────────
        const allDaysPredictions = await this.mlPredictor.predict(
            currentParams,
            this.formatDate(startDate),
            lat,
            lon,
        );
        this.logger.log(`ONNX model returned ${allDaysPredictions.length} days of predictions`);

        // ── Build daily forecasts from ONNX output ────────────────────────────
        const dailyForecasts = this.buildDailyForecasts(
            startDate,
            forecastDays,
            allDaysPredictions,
        );

        // Build response
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + forecastDays - 1);

        // ── Get calibrated forecasts using the calibration formula ────────────
        // This is the SINGLE SOURCE OF TRUTH for all monthly/seasonal production
        const productionHistory = await this.fetchProductionHistory(request.start_date);
        
        // NestJS gRPC converts snake_case proto fields to camelCase at runtime.
        // The proto field `num_salt_beds` arrives as `numSaltBeds` in the JS object
        // (not `num_salt_beds`). Reading `request.num_salt_beds` always returns
        // undefined → coerces to 0 → falls through to the 7500 default.
        //
        // Fix: read the camelCase runtime property first, fall back to snake_case
        // in case a future NestJS version changes the behaviour.
        const rawBeds = (request as any).numSaltBeds ?? request.num_salt_beds ?? 0;
        const numSaltBeds: number = rawBeds > 0 ? rawBeds : 7500;
        // STEP 2 removed — root cause fixed in api-gateway (num_salt_beds || 7500)

        
        const calibratedResult = await this.productionForecastService.forecast({
            currentDate:       request.start_date,
            numSaltBeds:       numSaltBeds,
            productionHistory,
        });

        // ── Use calibrated results for monthly/seasonal production ────────────
        // These use the calibration formula (single source of truth)
        const monthly6Months  = calibratedResult.monthlyProduction6Months;
        const monthly12Months = calibratedResult.monthlyProduction12Months;
        const seasonalProduction = calibratedResult.seasonalProduction;

        const response: PredictionResponse = {
            status: 'success',
            daily_parameters_forecast: {
                forecast_type:       'daily_parameters',
                forecast_start_date: this.formatDate(startDate),
                forecast_end_date:   this.formatDate(endDate),
                total_days:          forecastDays,
                forecasts:           dailyForecasts,
            },
            // Monthly/seasonal production using calibration formula (single source of truth)
            monthly_production_6months:  monthly6Months,
            monthly_production_12months: monthly12Months,
            seasonal_production:         seasonalProduction,
            model_info: {
                model_type:         'LSTM_Hybrid_with_Weather_ONNX',
                forecast_generated: this.formatDateTime(new Date()),
                performance_metrics: this.mlPredictor.performanceMetrics,
            },
            summary: {
                daily_forecast_days:         forecastDays,
                monthly_6_total_production:  monthly6Months.total_production,
                monthly_12_total_production: monthly12Months.total_production,
                maha_season_total:           seasonalProduction.seasons['Maha']?.total_production || 0,
                yala_season_total:           seasonalProduction.seasons['Yala']?.total_production || 0,
            },
            // Calibrated forecasts for reference (long-term beyond 60 days)
            calibratedMonthlyForecast: calibratedResult.calibratedMonthlyForecast,
            seasonalForecast:          calibratedResult.seasonalForecast,
            confidence:                calibratedResult.confidence,
        };

        return response;
    }

    /**
     * Trigger model retraining
     */
    async triggerRetraining(request: RetrainingRequest): Promise<RetrainingResponse> {
        return this.retrainingService.runRetraining(request.triggered_by);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Fetch last 6 months of production history from MongoDB.
     * Always returns an array — never throws.
     */
    private async fetchProductionHistory(startDate: string): Promise<ProductionHistoryItem[]> {
        try {
            const end   = new Date(startDate);
            const start = new Date(startDate);
            start.setMonth(start.getMonth() - 6);

            const startMonth = this.formatMonth(start);
            const endMonth   = this.formatMonth(end);

            const records = await this.actualMonthlyProductionModel
                .find({ month: { $gte: startMonth, $lte: endMonth } })
                .sort({ month: 1 })
                .lean()
                .exec();

            return records.map(r => ({
                month:            (r as any).month,
                production_volume: (r as any).production_volume,
            }));
        } catch (err) {
            this.logger.warn(`fetchProductionHistory failed — degrading gracefully: ${err}`);
            return [];
        }
    }

    /**
     * Build daily forecasts from ONNX model output (all 60 days at once).
     */
    private buildDailyForecasts(
        startDate: Date,
        forecastDays: number,
        allDaysPredictions: number[][],
    ): DailyForecast[] {
        const forecasts: DailyForecast[] = [];
        const daysToUse = Math.min(forecastDays, allDaysPredictions.length);

        for (let day = 0; day < daysToUse; day++) {
            const forecastDate = new Date(startDate);
            forecastDate.setDate(forecastDate.getDate() + day);
            const params = allDaysPredictions[day];

            forecasts.push({
                date:       this.formatDate(forecastDate),
                day_number: day + 1,
                parameters: {
                    water_temperature: params[0],
                    lagoon:            params[1],
                    OR_brine_level:    params[2],
                    OR_bund_level:     params[3],
                    IR_brine_level:    params[4],
                    IR_bound_level:    params[5],
                    East_channel:      params[6],
                    West_channel:      params[7],
                },
                weather: this.generateWeatherForecast(),
            });
        }

        this.logger.log(`Built ${forecasts.length} daily forecasts from ONNX output`);
        return forecasts;
    }

    /**
     * Generate weather forecast (placeholder - replace with actual weather API)
     */
    private generateWeatherForecast(): Weather {
        return {
            temperature_mean:     this.randomInRange(25, 28),
            temperature_min:      this.randomInRange(22, 25),
            temperature_max:      this.randomInRange(27, 30),
            rain_sum:             this.randomInRange(0, 0.1),
            wind_speed_max:       this.randomInRange(10, 30),
            wind_gusts_max:       this.randomInRange(20, 50),
            relative_humidity_mean: this.randomInRange(70, 90),
        };
    }

    // ─── Utility helpers ──────────────────────────────────────────────────────

    private parseDate(dateStr: string): Date {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${dateStr}`);
        }
        return date;
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private formatMonth(date: Date): string {
        const year  = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    private formatDateTime(date: Date): string {
        return date.toISOString().replace('T', ' ').split('.')[0];
    }

    private randomInRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }
}
