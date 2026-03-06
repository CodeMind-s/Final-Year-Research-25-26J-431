import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fsSync from 'fs';
import * as path from 'path';
import * as fs from 'fs/promises';
import axios from 'axios';

/** One day of weather features — matched to the 14-feature order in calibration_constants.json */
export interface WeatherDay {
    temperature_mean: number;
    temperature_max: number;
    temperature_min: number;
    rain_sum: number;
    wind_speed_max: number;
    wind_gusts_max: number;
    wind_gusts_mean: number;
    wind_speed_mean: number;
    wind_gusts_min: number;
    wind_speed_min: number;
    relative_humidity_mean: number;
    relative_humidity_mean_2: number;
    relative_humidity_max: number;
    relative_humidity_min: number;
}

/** Feature order that matches calibration_constants.json weather_feature_order */
const WEATHER_FEATURE_ORDER: (keyof WeatherDay)[] = [
    'temperature_mean',
    'temperature_max',
    'temperature_min',
    'rain_sum',
    'wind_speed_max',
    'wind_gusts_max',
    'wind_gusts_mean',
    'wind_speed_mean',
    'wind_gusts_min',
    'wind_speed_min',
    'relative_humidity_mean',
    'relative_humidity_mean_2',
    'relative_humidity_max',
    'relative_humidity_min',
];

@Injectable()
export class WeatherService implements OnModuleInit {
    private readonly logger = new Logger(WeatherService.name);

    /** Scaler constants for normalisation */
    private scalerCenter: number[] = [];
    private scalerScale: number[]  = [];

    private readonly scalerPath: string = (() => {
        const candidates = [
            path.join(__dirname, 'models/scaler_constants.json'),
            path.join(__dirname, '../models/scaler_constants.json'),
            path.join(process.cwd(), 'models/scaler_constants.json'),
            path.join(process.cwd(), 'apps/crystallization-onnx-service/models/scaler_constants.json'),
            path.join(process.cwd(), 'dist/apps/crystallization-onnx-service/models/scaler_constants.json'),
        ];
        for (const p of candidates) { if (fsSync.existsSync(p)) return p; }
        return candidates[0];
    })();

    private readonly calibrationPath: string = (() => {
        const candidates = [
            path.join(__dirname, 'models/calibration_constants.json'),
            path.join(__dirname, '../models/calibration_constants.json'),
            path.join(process.cwd(), 'models/calibration_constants.json'),
            path.join(process.cwd(), 'apps/crystallization-onnx-service/models/calibration_constants.json'),
            path.join(process.cwd(), 'dist/apps/crystallization-onnx-service/models/calibration_constants.json'),
        ];
        for (const p of candidates) { if (fsSync.existsSync(p)) return p; }
        return candidates[0];
    })();

    private monthlyAverages: Record<string, { avg_rain_mm: number; avg_temp_c: number }> = {};

    async onModuleInit() {
        await this.loadScalerConstants();
        await this.loadMonthlyAverages();
    }

    private async loadScalerConstants(): Promise<void> {
        try {
            const raw    = await fs.readFile(this.scalerPath, 'utf-8');
            const parsed = JSON.parse(raw);
            this.scalerCenter = parsed.weather_scaler.center as number[];
            this.scalerScale  = parsed.weather_scaler.scale  as number[];
            this.logger.log(`scaler_constants.json loaded from: ${this.scalerPath}`);
        } catch (err) {
            this.logger.error(`Failed to load scaler_constants.json: ${err}`);
        }
    }

    private async loadMonthlyAverages(): Promise<void> {
        try {
            const raw = await fs.readFile(this.calibrationPath, 'utf-8');
            this.monthlyAverages = JSON.parse(raw).historical_weather ?? {};
        } catch (err) {
            this.logger.warn(`Could not load monthly averages from calibration_constants.json: ${err}`);
        }
    }

    // ─── Fallback weather from monthly averages ────────────────────────────────

    private fallbackDayForDate(date: Date): WeatherDay {
        const monthNum = date.getMonth() + 1;
        const mx = this.monthlyAverages[monthNum.toString()];
        const temp  = mx?.avg_temp_c  ?? 27.0;
        const rain  = (mx?.avg_rain_mm ?? 100) / 30;
        const wind  = 5.0;
        const humid = 75.0;
        return {
            temperature_mean:     temp,
            temperature_max:      temp,
            temperature_min:      temp,
            rain_sum:             rain,
            wind_speed_max:       wind,
            wind_gusts_max:       wind,
            wind_gusts_mean:      wind,
            wind_speed_mean:      wind,
            wind_gusts_min:       wind,
            wind_speed_min:       wind,
            relative_humidity_mean:   humid,
            relative_humidity_mean_2: humid,
            relative_humidity_max:    humid,
            relative_humidity_min:    humid,
        };
    }

    private fallbackDays(dates: Date[]): WeatherDay[] {
        return dates.map(d => this.fallbackDayForDate(d));
    }

    // ─── OpenWeatherMap forecast (16-day daily) ────────────────────────────────

    async fetchForecastWeather(lat: number, lon: number): Promise<WeatherDay[]> {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            this.logger.warn('OPENWEATHER_API_KEY not configured — falling back to historical monthly averages');
            const today = new Date();
            return this.fallbackDays(Array.from({ length: 16 }, (_, i) => {
                const d = new Date(today); d.setDate(d.getDate() + i); return d;
            }));
        }

        try {
            // Developer plan endpoint (not pro.openweathermap.org)
            const url = `https://api.openweathermap.org/data/2.5/forecast/daily`;
            this.logger.log(`Fetching 16-day forecast for lat=${lat}, lon=${lon}`);
            const resp = await axios.get(url, {
                params: { lat, lon, cnt: 16, units: 'metric', appid: apiKey },
                timeout: 10_000,
            });
            const list = resp.data.list as any[];
            this.logger.log(`OpenWeatherMap forecast: received ${list.length} days`);
            return list.map(item => ({
                temperature_mean:     item.temp?.day    ?? item.main?.temp ?? 27,
                temperature_max:      item.temp?.max    ?? item.main?.temp_max ?? 27,
                temperature_min:      item.temp?.min    ?? item.main?.temp_min ?? 27,
                rain_sum:             item.rain         ?? 0,
                wind_speed_max:       item.speed        ?? item.wind?.speed ?? 5,
                wind_gusts_max:       item.gust         ?? item.wind?.gust ?? item.speed ?? item.wind?.speed ?? 5,
                wind_gusts_mean:      item.gust         ?? item.wind?.gust ?? item.speed ?? item.wind?.speed ?? 5,
                wind_speed_mean:      item.speed        ?? item.wind?.speed ?? 5,
                wind_gusts_min:       item.gust         ?? item.wind?.gust ?? item.speed ?? item.wind?.speed ?? 5,
                wind_speed_min:       item.speed        ?? item.wind?.speed ?? 5,
                relative_humidity_mean:   item.humidity ?? item.main?.humidity ?? 75,
                relative_humidity_mean_2: item.humidity ?? item.main?.humidity ?? 75,
                relative_humidity_max:    item.humidity ?? item.main?.humidity ?? 75,
                relative_humidity_min:    item.humidity ?? item.main?.humidity ?? 75,
            } as WeatherDay));
        } catch (err) {
            this.logger.warn(`OpenWeatherMap forecast API failed — falling back to monthly averages for affected days: ${err}`);
            const today = new Date();
            return this.fallbackDays(Array.from({ length: 16 }, (_, i) => {
                const d = new Date(today); d.setDate(d.getDate() + i); return d;
            }));
        }
    }

    // ─── OpenWeatherMap historical (day-by-day using One Call timemachine) ──────────────

    async fetchHistoricalWeather(
        lat: number,
        lon: number,
        startDate: Date,
        endDate: Date,
    ): Promise<WeatherDay[]> {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            this.logger.warn('OPENWEATHER_API_KEY not configured — falling back to historical monthly averages');
            return this.fallbackDaysInRange(startDate, endDate);
        }

        try {
            this.logger.log(`Fetching historical weather: ${startDate.toISOString().slice(0,10)} to ${endDate.toISOString().slice(0,10)}`);
            
            // Build array of dates needed
            const days: Date[] = [];
            const cur = new Date(startDate);
            while (cur <= endDate) {
                days.push(new Date(cur));
                cur.setDate(cur.getDate() + 1);
            }

            // Fetch each day using History API aggregated daily endpoint (Medium plan)
            // Base URL for aggregated daily data
            const results: WeatherDay[] = [];
            
            // Batch requests (max 10 concurrent to avoid rate limiting)
            const batchSize = 10;
            for (let i = 0; i < days.length; i += batchSize) {
                const batch = days.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (day) => {
                        try {
                            const dt = Math.floor(day.getTime() / 1000);
                            // History API per-day endpoint (requires History subscription)
                            const url = `https://history.openweathermap.org/data/3.0/history/timemachine`;
                            const resp = await axios.get(url, {
                                params: { lat, lon, dt, units: 'metric', appid: apiKey },
                                timeout: 10_000,
                            });
                            const data = resp.data.data?.[0] ?? resp.data;
                            return this.mapHistoricalDayToWeatherDay(data, day);
                        } catch (err: any) {
                            // Try alternative endpoint for older History API
                            try {
                                const dt = Math.floor(day.getTime() / 1000);
                                const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine`;
                                const resp = await axios.get(url, {
                                    params: { lat, lon, dt, units: 'metric', appid: apiKey },
                                    timeout: 10_000,
                                });
                                const data = resp.data.data?.[0] ?? resp.data;
                                return this.mapHistoricalDayToWeatherDay(data, day);
                            } catch {
                                // Fall back to monthly average for this specific day
                                return this.fallbackDayForDate(day);
                            }
                        }
                    })
                );
                results.push(...batchResults);
                
                // Small delay between batches to respect rate limits
                if (i + batchSize < days.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            this.logger.log(`OpenWeatherMap historical: fetched ${results.length} days`);
            return results;
        } catch (err) {
            this.logger.warn(`OpenWeatherMap historical API failed — falling back to monthly averages for affected days: ${err}`);
            return this.fallbackDaysInRange(startDate, endDate);
        }
    }

    private mapHistoricalDayToWeatherDay(data: any, day: Date): WeatherDay {
        // Handle different response formats from OpenWeatherMap
        const temp = data.temp ?? data.main?.temp ?? 27;
        const tempMax = data.temp_max ?? data.main?.temp_max ?? temp;
        const tempMin = data.temp_min ?? data.main?.temp_min ?? temp;
        const humidity = data.humidity ?? data.main?.humidity ?? 75;
        const windSpeed = data.wind_speed ?? data.wind?.speed ?? 5;
        const windGust = data.wind_gust ?? data.wind?.gust ?? windSpeed;
        const rain = data.rain?.['1h'] ?? data.rain ?? 0;

        return {
            temperature_mean: typeof temp === 'object' ? temp.day ?? 27 : temp,
            temperature_max: typeof tempMax === 'object' ? tempMax.max ?? tempMax : tempMax,
            temperature_min: typeof tempMin === 'object' ? tempMin.min ?? tempMin : tempMin,
            rain_sum: typeof rain === 'object' ? Object.values(rain).reduce((a: number, b: any) => a + (b || 0), 0) : rain,
            wind_speed_max: windSpeed,
            wind_gusts_max: windGust,
            wind_gusts_mean: windGust,
            wind_speed_mean: windSpeed,
            wind_gusts_min: windGust,
            wind_speed_min: windSpeed,
            relative_humidity_mean: humidity,
            relative_humidity_mean_2: humidity,
            relative_humidity_max: humidity,
            relative_humidity_min: humidity,
        };
    }

    private fallbackDaysInRange(startDate: Date, endDate: Date): WeatherDay[] {
        const days: Date[] = [];
        const cur = new Date(startDate);
        while (cur <= endDate) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
        return this.fallbackDays(days);
    }

    private aggregateHourlyToDaily(list: any[], startDate: Date, endDate: Date): WeatherDay[] {
        // Group hourly records by date string YYYY-MM-DD
        const grouped: Record<string, any[]> = {};
        for (const item of list) {
            const dt   = new Date((item.dt as number) * 1000);
            const key  = dt.toISOString().slice(0, 10);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        }

        // Build ordered day list
        const days: WeatherDay[] = [];
        const cur = new Date(startDate);
        while (cur <= endDate) {
            const key    = cur.toISOString().slice(0, 10);
            const hours  = grouped[key];
            if (hours && hours.length > 0) {
                const temps  = hours.map(h => h.main?.temp         ?? 27);
                const tempsMax= hours.map(h => h.main?.temp_max    ?? 27);
                const tempsMin= hours.map(h => h.main?.temp_min    ?? 27);
                const rains  = hours.map(h => h.rain?.['1h']       ?? 0);
                const winds  = hours.map(h => h.wind?.speed        ?? 5);
                const gusts  = hours.map(h => h.wind?.gust ?? h.wind?.speed ?? 5);
                const humids = hours.map(h => h.main?.humidity     ?? 75);
                const avg    = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
                const mx     = (arr: number[]) => Math.max(...arr);
                const mn     = (arr: number[]) => Math.min(...arr);
                days.push({
                    temperature_mean:         avg(temps),
                    temperature_max:          mx(tempsMax),
                    temperature_min:          mn(tempsMin),
                    rain_sum:                 rains.reduce((a, b) => a + b, 0),
                    wind_speed_max:           mx(winds),
                    wind_gusts_max:           mx(gusts),
                    wind_gusts_mean:          avg(gusts),
                    wind_speed_mean:          avg(winds),
                    wind_gusts_min:           mn(gusts),
                    wind_speed_min:           mn(winds),
                    relative_humidity_mean:   avg(humids),
                    relative_humidity_mean_2: avg(humids),
                    relative_humidity_max:    mx(humids),
                    relative_humidity_min:    mn(humids),
                });
            } else {
                days.push(this.fallbackDayForDate(cur));
            }
            cur.setDate(cur.getDate() + 1);
        }
        return days;
    }

    // ─── Normalise one day's features using scaler_constants.json ─────────────

    private normaliseDay(day: WeatherDay): number[] {
        return WEATHER_FEATURE_ORDER.map((feat, i) => {
            const raw    = day[feat] as number;
            const center = this.scalerCenter[i] ?? 0;
            const scale  = this.scalerScale[i]  ?? 1;
            return (raw - center) / scale;
        });
    }

    // ─── Build complete 60-day weather_input tensor ────────────────────────────

    async buildWeatherInput(lat: number, lon: number, startDate: string): Promise<Float32Array> {
        const refDate = new Date(startDate);

        // Step 1: Historical 44 days (startDate-44 .. startDate-1)
        const histEnd   = new Date(refDate); histEnd.setDate(histEnd.getDate() - 1);
        const histStart = new Date(refDate); histStart.setDate(histStart.getDate() - 44);

        let historical: WeatherDay[];
        try {
            historical = await this.fetchHistoricalWeather(lat, lon, histStart, histEnd);
        } catch {
            historical = this.fallbackDaysInRange(histStart, histEnd);
        }
        // Ensure exactly 44 entries — pad at start with fallback if API returned fewer
        while (historical.length < 44) {
            historical.unshift(this.fallbackDayForDate(histStart));
        }
        historical = historical.slice(-44); // take last 44 if more

        // Step 2: Forecast 16 days
        let forecast: WeatherDay[];
        try {
            forecast = await this.fetchForecastWeather(lat, lon);
        } catch {
            const today = new Date();
            forecast = this.fallbackDays(Array.from({ length: 16 }, (_, i) => {
                const d = new Date(today); d.setDate(d.getDate() + i); return d;
            }));
        }
        forecast = forecast.slice(0, 16); // ensure 16
        while (forecast.length < 16) {
            forecast.push(this.fallbackDayForDate(new Date()));
        }

        // Step 3: Combine → 60 days
        const allWeather = [...historical, ...forecast]; // exactly 60

        // Step 4: Normalise and flatten → [1, 60, 14]
        const numDays     = 60;
        const numFeatures = 14;
        const result      = new Float32Array(numDays * numFeatures);
        for (let d = 0; d < numDays; d++) {
            const normalised = this.normaliseDay(allWeather[d]);
            for (let f = 0; f < numFeatures; f++) {
                result[d * numFeatures + f] = normalised[f];
            }
        }
        return result;
    }
}
