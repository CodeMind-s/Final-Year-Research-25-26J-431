import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MlPredictorService } from './ml-predictor.service';
import { ProductionForecastService } from './production-forecast.service';
import { RetrainingService } from './retraining.service';
import { WeatherService } from './weather.service';
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
        private readonly weatherService: WeatherService,
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
        this.logger.log(`🔵 [ONNX MODEL OUTPUT] First 3 days of 8-parameter predictions:`);
        allDaysPredictions.slice(0, 3).forEach((day, idx) => {
            this.logger.log(`   Day ${idx + 1}: [${day.map(v => v.toFixed(2)).join(', ')}]`);
        });

        // ── Fetch actual weather data for the forecast period ─────────────────
        let weatherData: any[];
        try {
            weatherData = await this.weatherService.fetchForecastWeather(lat, lon);
            this.logger.log(`🌤️ [WEATHER API] Fetched ${weatherData.length} days (NOT from ONNX model)`);
        } catch (err) {
            this.logger.warn(`🌤️ [WEATHER FALLBACK] Using historical averages: ${err}`);
            weatherData = [];
        }

        // ── Build daily forecasts from ONNX output ────────────────────────────
        const dailyForecasts = this.buildDailyForecasts(
            startDate,
            forecastDays,
            allDaysPredictions,
            weatherData,
        );

        // Build response
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + forecastDays - 1);

        // ── Get calibrated forecasts using the calibration formula ────────────
        // This is the SINGLE SOURCE OF TRUTH for all monthly/seasonal production
        this.logger.log(`📊 [CALIBRATION] Calculating monthly/seasonal production (NOT from ONNX model)`);
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

        this.logger.log(`📊 [CALIBRATION RESULTS]:`);
        this.logger.log(`   6-month total: ${monthly6Months.total_production.toFixed(0)} kg`);
        this.logger.log(`   12-month total: ${monthly12Months.total_production.toFixed(0)} kg`);
        this.logger.log(`   Maha season: ${seasonalProduction.seasons['Maha']?.total_production.toFixed(0) || 0} kg`);
        this.logger.log(`   Yala season: ${seasonalProduction.seasons['Yala']?.total_production.toFixed(0) || 0} kg`);

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
        weatherData: any[],
    ): DailyForecast[] {
        const forecasts: DailyForecast[] = [];
        const daysToUse = Math.min(forecastDays, allDaysPredictions.length);

        let weatherFromAPI = 0;
        let weatherFromFallback = 0;

        for (let day = 0; day < daysToUse; day++) {
            const forecastDate = new Date(startDate);
            forecastDate.setDate(forecastDate.getDate() + day);
            const params = allDaysPredictions[day];

            // Use actual weather data for this day if available
            const weather = weatherData[day] 
                ? (weatherFromAPI++, this.mapWeatherDayToWeatherInterface(weatherData[day]))
                : (weatherFromFallback++, this.generateWeatherFallback(forecastDate));

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
                weather,
            });
        }

        this.logger.log(`✅ Built ${forecasts.length} daily forecasts from ONNX output with actual weather data`);
        this.logger.log(`   - Parameters (8 values): FROM ONNX MODEL ✅`);
        this.logger.log(`   - Weather: ${weatherFromAPI} days from API, ${weatherFromFallback} days from fallback ⚠️`);
        return forecasts;
    }

    /**
     * Map WeatherDay from WeatherService to Weather interface for response
     */
    private mapWeatherDayToWeatherInterface(weatherDay: any): Weather {
        return {
            temperature_mean:     weatherDay.temperature_mean ?? 27,
            temperature_min:      weatherDay.temperature_min ?? 22,
            temperature_max:      weatherDay.temperature_max ?? 30,
            rain_sum:             weatherDay.rain_sum ?? 0,
            wind_speed_max:       weatherDay.wind_speed_max ?? 15,
            wind_gusts_max:       weatherDay.wind_gusts_max ?? 30,
            relative_humidity_mean: weatherDay.relative_humidity_mean ?? 75,
        };
    }

    /**
     * Generate fallback weather based on historical monthly averages
     */
    private generateWeatherFallback(date: Date): Weather {
        // Fallback values based on typical Sri Lankan coastal weather
        const monthlyDefaults: Record<number, Weather> = {
            0:  { temperature_mean: 26.5, temperature_min: 23, temperature_max: 30, rain_sum: 2.5, wind_speed_max: 15, wind_gusts_max: 25, relative_humidity_mean: 78 }, // Jan
            1:  { temperature_mean: 27.0, temperature_min: 23, temperature_max: 30, rain_sum: 1.8, wind_speed_max: 16, wind_gusts_max: 26, relative_humidity_mean: 76 }, // Feb
            2:  { temperature_mean: 27.5, temperature_min: 24, temperature_max: 31, rain_sum: 3.0, wind_speed_max: 14, wind_gusts_max: 24, relative_humidity_mean: 77 }, // Mar
            3:  { temperature_mean: 28.0, temperature_min: 25, temperature_max: 31, rain_sum: 8.5, wind_speed_max: 12, wind_gusts_max: 22, relative_humidity_mean: 80 }, // Apr
            4:  { temperature_mean: 28.0, temperature_min: 26, temperature_max: 31, rain_sum: 12.0, wind_speed_max: 13, wind_gusts_max: 23, relative_humidity_mean: 82 }, // May
            5:  { temperature_mean: 27.5, temperature_min: 26, temperature_max: 30, rain_sum: 6.0, wind_speed_max: 18, wind_gusts_max: 28, relative_humidity_mean: 81 }, // Jun
            6:  { temperature_mean: 27.0, temperature_min: 25, temperature_max: 30, rain_sum: 4.0, wind_speed_max: 20, wind_gusts_max: 30, relative_humidity_mean: 79 }, // Jul
            7:  { temperature_mean: 27.0, temperature_min: 25, temperature_max: 30, rain_sum: 4.5, wind_speed_max: 18, wind_gusts_max: 28, relative_humidity_mean: 79 }, // Aug
            8:  { temperature_mean: 27.0, temperature_min: 25, temperature_max: 30, rain_sum: 6.5, wind_speed_max: 16, wind_gusts_max: 26, relative_humidity_mean: 80 }, // Sep
            9:  { temperature_mean: 26.5, temperature_min: 24, temperature_max: 29, rain_sum: 11.0, wind_speed_max: 14, wind_gusts_max: 24, relative_humidity_mean: 82 }, // Oct
            10: { temperature_mean: 26.0, temperature_min: 23, temperature_max: 29, rain_sum: 12.5, wind_speed_max: 13, wind_gusts_max: 23, relative_humidity_mean: 83 }, // Nov
            11: { temperature_mean: 26.0, temperature_min: 23, temperature_max: 29, rain_sum: 5.5, wind_speed_max: 14, wind_gusts_max: 24, relative_humidity_mean: 80 }, // Dec
        };
        
        const month = date.getMonth();
        const defaults = monthlyDefaults[month] ?? monthlyDefaults[0];
        
        this.logger.debug(`Using fallback weather for ${this.formatDate(date)} (month ${month + 1})`);
        return defaults;
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
}
