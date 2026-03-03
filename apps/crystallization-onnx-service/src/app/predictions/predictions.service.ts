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
    CurrentValues,
    DailyForecast,
    MonthlyProductionForecast,
    MonthlyForecast,
    SeasonalProduction,
    SeasonData,
    Weather,
    ProductionHistoryItem,
    RetrainingRequest,
    RetrainingResponse,
} from './dtos/interfaces';

/**
 * Service containing business logic for predictions.
 * Port of Python prediction_service.py and ml_predictor.py logic.
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
     * Generate predictions based on current values and forecast days
     */
    async getPredictions(request: PredictionRequest): Promise<PredictionResponse> {
        if (!this.mlPredictor.isReady()) {
            throw new Error('Model not loaded. Please ensure the model file exists.');
        }

        const startDate    = this.parseDate(request.start_date);
        const forecastDays = request.forecast_days;
        const currentValues = request.current_values;

        // Generate daily forecasts
        const dailyForecasts = await this.generateDailyForecasts(
            startDate,
            forecastDays,
            currentValues,
            request,
        );

        // Generate monthly forecasts
        const monthly6Months  = this.generateMonthlyForecast(dailyForecasts, startDate, 6);
        const monthly12Months = this.generateMonthlyForecast(dailyForecasts, startDate, 12);

        // Generate seasonal production
        const seasonalProduction = this.generateSeasonalProduction(monthly12Months);

        // Build response
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + forecastDays - 1);

        const response: PredictionResponse = {
            status: 'success',
            daily_parameters_forecast: {
                forecast_type:       'daily_parameters',
                forecast_start_date: this.formatDate(startDate),
                forecast_end_date:   this.formatDate(endDate),
                total_days:          forecastDays,
                forecasts:           dailyForecasts,
            },
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
        };

        // ── Calibrated production forecast, seasonal forecast & confidence ────
        const productionHistory = await this.fetchProductionHistory(request.start_date);
        const productionResult  = await this.productionForecastService.forecast({
            currentDate:       request.start_date,
            numSaltBeds:       request.num_salt_beds ?? 7500,
            productionHistory,
        });

        response.calibratedMonthlyForecast = productionResult.calibratedMonthlyForecast;
        response.seasonalForecast          = productionResult.seasonalForecast;
        response.confidence                = productionResult.confidence;

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
     * Generate daily forecasts using the ONNX model - NO FALLBACK
     */
    private async generateDailyForecasts(
        startDate: Date,
        forecastDays: number,
        currentValues: CurrentValues,
        request?: PredictionRequest,
    ): Promise<DailyForecast[]> {
        const forecasts: DailyForecast[] = [];

        let currentParams = [
            currentValues.water_temperature,
            currentValues.lagoon,
            currentValues.OR_brine_level,
            currentValues.OR_bund_level,
            currentValues.IR_brine_level,
            currentValues.IR_bound_level,
            currentValues.East_channel,
            currentValues.West_channel,
        ];

        this.logger.log(`Starting daily forecast generation for ${forecastDays} days`);
        this.logger.log(`Initial parameters: ${currentParams.join(', ')}`);

        const lat = request?.latitude ?? (parseFloat(process.env.OPENWEATHER_LAT ?? '') || 7.2008);
        const lon = request?.longitude ?? (parseFloat(process.env.OPENWEATHER_LON ?? '') || 79.8737);

        for (let day = 0; day < forecastDays; day++) {
            const forecastDate = new Date(startDate);
            forecastDate.setDate(forecastDate.getDate() + day);

            // Get predictions from ONNX model (now passes date + location)
            const predictedParams = await this.mlPredictor.predict(
                currentParams,
                this.formatDate(forecastDate),
                lat,
                lon,
            );

            if (predictedParams.length < 8) {
                throw new Error(
                    `Model returned ${predictedParams.length} parameters, expected 8.`,
                );
            }

            if (day % 10 === 0) {
                this.logger.log(`Generated prediction for day ${day + 1}/${forecastDays}`);
            }

            const weather = this.generateWeatherForecast();

            const forecastItem: DailyForecast = {
                date:       this.formatDate(forecastDate),
                day_number: day + 1,
                parameters: {
                    water_temperature: predictedParams[0],
                    lagoon:            predictedParams[1],
                    OR_brine_level:    predictedParams[2],
                    OR_bund_level:     predictedParams[3],
                    IR_brine_level:    predictedParams[4],
                    IR_bound_level:    predictedParams[5],
                    East_channel:      predictedParams[6],
                    West_channel:      predictedParams[7],
                },
                weather,
            };

            forecasts.push(forecastItem);
            currentParams = predictedParams.slice(0, 8);
        }

        this.logger.log(`Successfully generated ${forecasts.length} daily forecasts`);
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
            rain_sum:             this.randomInRange(0, 5),
            wind_speed_max:       this.randomInRange(10, 30),
            wind_gusts_max:       this.randomInRange(20, 50),
            relative_humidity_mean: this.randomInRange(70, 90),
        };
    }

    /**
     * Generate monthly production forecast from daily forecasts - CALCULATED FROM MODEL OUTPUT
     */
    private generateMonthlyForecast(
        dailyForecasts: DailyForecast[],
        startDate: Date,
        months: number,
    ): MonthlyProductionForecast {
        const monthlyForecasts: MonthlyForecast[] = [];
        let totalProduction = 0;

        const currentMonthStart = new Date(startDate);
        currentMonthStart.setDate(1);

        this.logger.log(
            `Calculating monthly production from ${dailyForecasts.length} daily forecasts`,
        );

        for (let monthNum = 0; monthNum < months; monthNum++) {
            const monthDate = new Date(currentMonthStart);
            monthDate.setMonth(monthDate.getMonth() + monthNum);
            const monthStr = this.formatMonth(monthDate);

            const monthDailyForecasts = dailyForecasts.filter(f =>
                f.date.startsWith(monthStr),
            );

            let production = 0;
            for (const dayForecast of monthDailyForecasts) {
                const params = dayForecast.parameters;
                const dailyProduction =
                    params.OR_brine_level * 50 +
                    params.IR_brine_level * 50 +
                    params.East_channel   * 30 +
                    params.West_channel   * 30 +
                    params.lagoon         * 20;
                production += dailyProduction;
            }

            if (monthDailyForecasts.length === 0) {
                this.logger.warn(`No daily forecasts available for ${monthStr}, estimating...`);
                if (monthlyForecasts.length > 0) {
                    production = monthlyForecasts[monthlyForecasts.length - 1].production_forecast;
                }
            }

            const lowerBound = production * 0.85;
            const upperBound = production * 1.15;

            const month = monthDate.getMonth() + 1;
            let season: string;
            if      ([12, 1, 2, 3].includes(month)) season = 'Maha';
            else if ([4, 5, 6, 7].includes(month))  season = 'Yala';
            else                                     season = 'Other';

            monthlyForecasts.push({
                month:              monthStr,
                month_number:       monthNum + 1,
                production_forecast: production,
                lower_bound:        lowerBound,
                upper_bound:        upperBound,
                season,
            });

            totalProduction += production;
            this.logger.log(
                `Month ${monthStr}: ${monthDailyForecasts.length} days, production=${production.toFixed(2)}`,
            );
        }

        const endMonth = new Date(currentMonthStart);
        endMonth.setMonth(endMonth.getMonth() + months - 1);

        return {
            forecast_type:        'monthly_production',
            forecast_period:      `${months}_months`,
            forecast_start_month: this.formatMonth(currentMonthStart),
            forecast_end_month:   this.formatMonth(endMonth),
            total_months:         monthlyForecasts.length,
            total_production:     totalProduction,
            forecasts:            monthlyForecasts,
        };
    }

    /**
     * Generate seasonal production summary
     */
    private generateSeasonalProduction(
        monthlyForecast: MonthlyProductionForecast,
    ): SeasonalProduction {
        const seasons: Record<string, SeasonData> = {};

        for (const forecast of monthlyForecast.forecasts) {
            const season = forecast.season;
            if (!seasons[season]) {
                seasons[season] = { months_count: 0, total_production: 0, months: [] };
            }
            seasons[season].months_count   += 1;
            seasons[season].total_production += forecast.production_forecast;
            seasons[season].months.push({
                month:      forecast.month,
                production: forecast.production_forecast,
            });
        }

        return {
            forecast_type:   'seasonal_production',
            forecast_period: '12_months',
            seasons,
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
