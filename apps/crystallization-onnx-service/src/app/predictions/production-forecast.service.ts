import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import type {
    CalibrationConstants,
    CalibratedMonthlyForecast,
    SeasonForecast,
    ConfidenceReport,
    ProductionForecastResult,
    ProductionHistoryItem,
    MonthlyProductionForecast,
    MonthlyForecast,
    SeasonalProduction,
    SeasonData,
} from './dtos/interfaces';

@Injectable()
export class ProductionForecastService implements OnModuleInit {
    private readonly logger = new Logger(ProductionForecastService.name);
    private constants: CalibrationConstants;

    /**
     * Resolve path to calibration_constants.json using same multi-path
     * strategy as ml-predictor.service.ts.
     */
    private readonly constantsPath: string = (() => {
        const candidates = [
            path.join(__dirname, 'models/calibration_constants.json'),
            path.join(__dirname, '../models/calibration_constants.json'),
            path.join(process.cwd(), 'models/calibration_constants.json'),
            path.join(process.cwd(), 'apps/crystallization-onnx-service/models/calibration_constants.json'),
            path.join(process.cwd(), 'dist/apps/crystallization-onnx-service/models/calibration_constants.json'),
        ];
        for (const p of candidates) {
            if (fsSync.existsSync(p)) return p;
        }
        // Return first candidate as default (will be read async; error handled there)
        return candidates[0];
    })();

    async onModuleInit() {
        await this.loadConstants();
    }

    async loadConstants(): Promise<void> {
        try {
            console.log('Loading constants from:', this.constantsPath);
            console.log('RESOLVED FILE PATH:', this.constantsPath);
            const raw = await fs.readFile(this.constantsPath, 'utf-8');
            console.log('Raw JSON length:', raw.length);
            const parsed = JSON.parse(raw);
            console.log('PARSED JSON KEYS:', Object.keys(parsed));
            console.log('PARSED beds_coef:', parsed.beds_coef);
            this.constants = parsed;
            this.logger.log(`calibration_constants.json loaded from: ${this.constantsPath}`);
            
            console.log('Loaded constants:', JSON.stringify({
                beds_coef:    this.constants.beds_coef,
                rain_coef:    this.constants.rain_coef,
                temp_coef:    this.constants.temp_coef,
                sin_coef:     this.constants.sin_coef,
                cos_coef:     this.constants.cos_coef,
                intercept:    this.constants.intercept,
                pi_half_width: this.constants.pi_half_width,
                n_historical_weather_months:
                    Object.keys(this.constants.historical_weather ?? {}).length
            }));
        } catch (err) {
            this.logger.error(`Failed to load calibration_constants.json from ${this.constantsPath}: ${err}`);
            throw err;
        }
    }

    // ─── Yield ratio ────────────────────────────────────────────────────────

    private computeYieldRatio(
        history: ProductionHistoryItem[],
        numSaltBeds: number,
    ): { yieldRatio: number; ratios: number[]; nMonths: number } {
        if (!history || history.length === 0) {
            this.logger.log('computeYieldRatio: no history, returning yieldRatio=1.0');
            return { yieldRatio: 1.0, ratios: [], nMonths: 0 };
        }
        
        this.logger.log(`computeYieldRatio: processing ${history.length} months with numSaltBeds=${numSaltBeds}`);
        
        const FACILITY_THRESHOLD = 2000;
        const ratios: number[] = [];
        for (const item of history) {
            const monthNum = new Date(item.month).getMonth() + 1;
            const wx = this.constants.historical_weather[monthNum.toString()];
            if (!wx) {
                this.logger.warn(`computeYieldRatio: no wx data for month ${monthNum}, skipping`);
                continue;
            }
            const mSin = Math.sin(2 * Math.PI * monthNum / 12);
            const mCos = Math.cos(2 * Math.PI * monthNum / 12);

            let formulaPred: number;
            if (numSaltBeds >= FACILITY_THRESHOLD) {
                // Tier 1: large facility — use formula directly with provided bed count
                formulaPred = Math.max(1,
                    this.constants.beds_coef  * numSaltBeds
                    + this.constants.rain_coef * wx.avg_rain_mm
                    + this.constants.temp_coef * wx.avg_temp_c
                    + this.constants.sin_coef  * mSin
                    + this.constants.cos_coef  * mCos
                    + this.constants.intercept,
                );
            } else {
                // Tier 2: individual owner — but production HISTORY is still from the full
                // facility (MongoDB stores facility-level actuals). We must compare actual
                // output against the facility-level formula prediction so the yield ratio
                // reflects saltern efficiency, not an absurd actual/30-bed ratio.
                // Per-bed scaling only applies in forecastMonth() for forward projections.
                formulaPred = Math.max(1,
                    this.constants.beds_coef  * this.constants.historical_avg_beds
                    + this.constants.rain_coef * wx.avg_rain_mm
                    + this.constants.temp_coef * wx.avg_temp_c
                    + this.constants.sin_coef  * mSin
                    + this.constants.cos_coef  * mCos
                    + this.constants.intercept,
                );
            }


            const ratio = item.production_volume / formulaPred;
            
            console.log(`yieldRatio item: month=${item.month} actual=${item.production_volume} formulaPred=${formulaPred.toFixed(2)} ratio=${ratio.toFixed(6)}`);
            
            ratios.push(ratio);
        }
        
        if (ratios.length === 0) {
            this.logger.warn('computeYieldRatio: no valid ratios computed, returning yieldRatio=1.0');
            return { yieldRatio: 1.0, ratios: [], nMonths: 0 };
        }
        
        const sorted = [...ratios].sort((a, b) => a - b);
        const mid    = Math.floor(sorted.length / 2);
        const yieldRatio = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        
        this.logger.log(`computeYieldRatio: final yieldRatio=${yieldRatio.toFixed(4)} (median of ${ratios.length} ratios)`);
        
        return { yieldRatio, ratios, nMonths: history.length };
    }

    private detectYieldStatus(yieldRatio: number): 'NORMAL' | 'BELOW_AVERAGE' | 'LOW' | 'CRITICAL' {
        if (yieldRatio < 0.3) return 'CRITICAL';
        if (yieldRatio < 0.5) return 'LOW';
        if (yieldRatio < 0.8) return 'BELOW_AVERAGE';
        return 'NORMAL';
    }

    private detectTrend(ratios: number[]): { decliningTrend: boolean; improvingTrend: boolean } {
        if (ratios.length < 3) return { decliningTrend: false, improvingTrend: false };
        const mid        = Math.floor(ratios.length / 2);
        const firstHalf  = ratios.slice(0, mid);
        const secondHalf = ratios.slice(mid);
        const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const diff = mean(secondHalf) - mean(firstHalf);
        return { decliningTrend: diff < -0.2, improvingTrend: diff > 0.2 };
    }

    // ─── Single-month forecast ───────────────────────────────────────────────

    public forecastMonth(
        monthNum: number,
        numSaltBeds: number,
        yieldRatio: number,
    ): { expected: number; lower95: number; upper95: number } {
        // Guard: ensure constants are loaded
        if (!this.constants) {
            this.logger.error('forecastMonth called before constants loaded!');
            throw new Error('CalibrationConstants not loaded. Ensure loadConstants() completed.');
        }

        const wx = this.constants.historical_weather[monthNum.toString()];

        if (!wx) {
            this.logger.warn(
                `No historical weather for monthNum=${monthNum}. ` +
                `Check calibration_constants.json historical_weather keys (expected "1"–"12").`,
            );
            return { expected: 0, lower95: 0, upper95: 0 };
        }

        const FACILITY_THRESHOLD = 2000;
        const mSin = Math.sin(2 * Math.PI * monthNum / 12);
        const mCos = Math.cos(2 * Math.PI * monthNum / 12);
        let base: number;

        if (numSaltBeds >= FACILITY_THRESHOLD) {
            // ── Tier 1: Large facility — use formula directly ──────────────────
            base = Math.max(0,
                this.constants.beds_coef  * numSaltBeds
                + this.constants.rain_coef * wx.avg_rain_mm
                + this.constants.temp_coef * wx.avg_temp_c
                + this.constants.sin_coef  * mSin
                + this.constants.cos_coef  * mCos
                + this.constants.intercept,
            );
        } else {
            // ── Tier 2: Individual owner — per-bed scaling ────────────────────
            // Formula trained on 7,500-10,000 bed facilities; applying intercept
            // (-279,846) directly to 30 beds gives negative output.
            // Solution: compute the per-bed rate at the historical average bed count,
            // then scale linearly to the owner's actual bed count.
            const baseAtAvgBeds = Math.max(0,
                this.constants.beds_coef  * this.constants.historical_avg_beds
                + this.constants.rain_coef * wx.avg_rain_mm
                + this.constants.temp_coef * wx.avg_temp_c
                + this.constants.sin_coef  * mSin
                + this.constants.cos_coef  * mCos
                + this.constants.intercept,
            );
            const perBedRate = baseAtAvgBeds / this.constants.historical_avg_beds;
            base = perBedRate * numSaltBeds;
        }

        const expected = base * yieldRatio;
        this.logger.debug(
            `forecastMonth: month=${monthNum} beds=${numSaltBeds} ` +
            `tier=${numSaltBeds >= FACILITY_THRESHOLD ? 'FACILITY' : 'INDIVIDUAL_OWNER'} ` +
            `base=${base.toFixed(2)} expected=${expected.toFixed(2)}`,
        );

        return {
            expected,
            lower95: Math.max(0, expected - this.constants.pi_half_width),
            upper95: expected + this.constants.pi_half_width,
        };
    }

    public getSeasonForMonth(monthNum: number): string {
        const sm = this.constants.season_months;
        if (sm.Yala.includes(monthNum))  return 'Yala';
        if (sm.Maha.includes(monthNum))  return 'Maha';
        return 'Transition';
    }

    // ─── Season helpers ──────────────────────────────────────────────────────

    private getCurrentAndNextSeason(currentDate: Date): {
        currentSeason: string;
        currentMonths: number[];
        nextSeason: string;
        nextMonths: number[];
    } {
        const monthNum = currentDate.getMonth() + 1;
        const sm = this.constants.season_months;
        let currentSeason: string;
        let currentMonths: number[];
        if (sm.Yala.includes(monthNum)) {
            currentSeason = 'Yala'; currentMonths = sm.Yala;
        } else if (sm.Maha.includes(monthNum)) {
            currentSeason = 'Maha'; currentMonths = sm.Maha;
        } else {
            currentSeason = 'Transition'; currentMonths = sm.Transition;
        }
        const nextSeason  = currentSeason === 'Yala' ? 'Maha'
                          : currentSeason === 'Maha' ? 'Yala'
                          : 'Yala';
        const nextMonths  = nextSeason === 'Yala' ? sm.Yala : sm.Maha;
        return { currentSeason, currentMonths, nextSeason, nextMonths };
    }

    private buildSeasonForecast(
        seasonName: string,
        monthNums: number[],
        status: 'current' | 'next',
        currentDate: Date,
        numSaltBeds: number,
        yieldRatio: number,
        productionHistory: ProductionHistoryItem[],
    ): SeasonForecast {
        const currentYear  = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        let actualToDate = 0;
        let predExpected = 0;
        let predLower    = 0;
        let predUpper    = 0;
        const months: CalibratedMonthlyForecast[] = [];

        for (const mNum of monthNums) {
            // Determine the correct calendar year for this season month
            let year = currentYear;
            if (status === 'next') {
                if (mNum <= currentMonth) year = currentYear + 1;
            } else {
                // Maha wraps Jan/Feb into next calendar year
                if (seasonName === 'Maha' && mNum < 11) year = currentYear + 1;
            }

            const monthStr  = `${year}-${String(mNum).padStart(2, '0')}-01`;
            const monthDate = new Date(year, mNum - 1, 1);
            const isPast    = monthDate < new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

            const histEntry = productionHistory.find(h =>
                h.month.startsWith(`${year}-${String(mNum).padStart(2, '0')}`),
            );

            console.log(`buildSeason: season=${seasonName} mNum=${mNum} year=${year} monthStr=${monthStr} isPast=${isPast} type=${isPast && histEntry ? 'ACTUAL' : 'PREDICTED'}`);

            if (isPast && histEntry) {
                actualToDate += histEntry.production_volume;
                months.push({
                    month:    monthStr,
                    season:   seasonName,
                    lower95:  histEntry.production_volume,
                    expected: histEntry.production_volume,
                    upper95:  histEntry.production_volume,
                    type: 'ACTUAL',
                });
            } else {
                const { expected, lower95, upper95 } =
                    this.forecastMonth(mNum, numSaltBeds, yieldRatio);
                predExpected += expected;
                predLower    += lower95;
                predUpper    += upper95;
                months.push({
                    month: monthStr, season: seasonName,
                    lower95, expected, upper95, type: 'PREDICTED',
                });
            }
        }

        return {
            season: seasonName,
            status,
            lower95Total:  actualToDate + predLower,
            expectedTotal: actualToDate + predExpected,
            upper95Total:  actualToDate + predUpper,
            actualToDate,
            months,
        };
    }

    // ─── Confidence report ───────────────────────────────────────────────────

    private computeConfidence(params: {
        yieldRatio: number;
        yieldStatus: string;
        decliningTrend: boolean;
        improvingTrend: boolean;
        nHistoryMonths: number;
        numSaltBeds: number;
    }): ConfidenceReport {
        const c = this.constants;
        const scoreFormula = c.r2_score * 100;
        const scoreHoldout = Math.max(0, 100 - (c.holdout_mae / 1000));
        const scoreData    = Math.min((c.n_months / 60) * 100, 100);
        let scoreYield     = params.yieldStatus === 'NORMAL'        ? 90
                           : params.yieldStatus === 'BELOW_AVERAGE' ? 70
                           : 40;
        if (params.decliningTrend) scoreYield = Math.max(scoreYield - 20, 20);

        const overall = (scoreFormula * 0.30)
                      + (scoreHoldout * 0.40)
                      + (scoreData    * 0.20)
                      + (scoreYield   * 0.10);

        const overallRating = overall >= 80 ? 'HIGH CONFIDENCE'
                            : overall >= 60 ? 'MEDIUM CONFIDENCE — suitable for planning'
                            : overall >= 40 ? 'LOW-MEDIUM — use as a guide'
                            : 'LOW CONFIDENCE';

        const isFacility = params.numSaltBeds >= 2000;
        const bedCountTier: ConfidenceReport['bedCountTier'] = isFacility ? 'FACILITY' : 'INDIVIDUAL_OWNER';
        const bedCountNote = isFacility
            ? undefined
            : `Forecast uses per-bed scaling. Owner has ${params.numSaltBeds} beds vs facility average of ` +
              `${this.constants.historical_avg_beds} beds. Accuracy depends on this owner performing ` +
              `proportionally to the facility average. Individual owner training data would improve accuracy.`;

        return {
            overallScore:    Math.round(overall * 10) / 10,
            overallRating,
            yieldRatio:      params.yieldRatio,
            yieldStatus:     params.yieldStatus as ConfidenceReport['yieldStatus'],
            decliningTrend:  params.decliningTrend,
            improvingTrend:  params.improvingTrend,
            formulaR2:       c.r2_score,
            holdoutMae:      c.holdout_mae,
            nHistoryMonths:  params.nHistoryMonths,
            formulaFitScore: scoreFormula,
            holdoutScore:    scoreHoldout,
            dataVolumeScore: scoreData,
            yieldScore:      scoreYield,
            bedCountTier,
            bedCountNote,
        };
    }

    // ─── Public forecast entry point ─────────────────────────────────────────

    async forecast(params: {
        currentDate: string;
        numSaltBeds: number;
        productionHistory: ProductionHistoryItem[];
    }): Promise<ProductionForecastResult> {
        const tier = params.numSaltBeds >= 2000 ? 'FACILITY' : 'INDIVIDUAL_OWNER';
        this.logger.log(`forecast numSaltBeds=${params.numSaltBeds} tier=${tier}`);
        
        const date = new Date(params.currentDate);
        const { yieldRatio, ratios, nMonths } =
            this.computeYieldRatio(params.productionHistory, params.numSaltBeds);
        const yieldStatus = this.detectYieldStatus(yieldRatio);
        const { decliningTrend, improvingTrend } = this.detectTrend(ratios);
        const { currentSeason, currentMonths, nextSeason, nextMonths } =
            this.getCurrentAndNextSeason(date);

        const currentSeasonForecast = this.buildSeasonForecast(
            currentSeason, currentMonths, 'current',
            date, params.numSaltBeds, yieldRatio, params.productionHistory,
        );
        const nextSeasonForecast = this.buildSeasonForecast(
            nextSeason, nextMonths, 'next',
            date, params.numSaltBeds, yieldRatio, params.productionHistory,
        );

        // Next 2 calendar months from currentDate
        const calibratedMonthlyForecast: CalibratedMonthlyForecast[] = [];
        const baseForecastYear = date.getFullYear();
        const baseForecastMonth = date.getMonth(); // 0-11
        
        for (let i = 1; i <= 2; i++) {
            const totalMonths = baseForecastMonth + i;
            const targetYear = baseForecastYear + Math.floor(totalMonths / 12);
            const targetMonth = totalMonths % 12; // 0-11
            const mNum = targetMonth + 1; // 1-12
            const monthStr = `${targetYear}-${String(mNum).padStart(2, '0')}-01`;
            
            const { expected, lower95, upper95 } =
                this.forecastMonth(mNum, params.numSaltBeds, yieldRatio);
            calibratedMonthlyForecast.push({
                month:  monthStr,
                season: this.getSeasonForMonth(mNum),
                lower95, expected, upper95,
                type: 'PREDICTED',
            });
        }

        const confidence = this.computeConfidence({
            yieldRatio, yieldStatus, decliningTrend, improvingTrend,
            nHistoryMonths: nMonths,
            numSaltBeds: params.numSaltBeds,
        });

        // Generate 6-month and 12-month production forecasts using calibration formula
        const monthlyProduction6Months = this.generateMonthlyProductionForecast(
            date, 6, params.numSaltBeds, yieldRatio,
        );
        const monthlyProduction12Months = this.generateMonthlyProductionForecast(
            date, 12, params.numSaltBeds, yieldRatio,
        );

        // Generate seasonal production aggregation
        const seasonalProduction = this.generateSeasonalProduction(
            monthlyProduction12Months,
        );

        return {
            calibratedMonthlyForecast,
            seasonalForecast: [currentSeasonForecast, nextSeasonForecast],
            confidence,
            monthlyProduction6Months,
            monthlyProduction12Months,
            seasonalProduction,
        };
    }

    // ─── Generate N-month production forecast using calibration formula ─────

    private generateMonthlyProductionForecast(
        startDate: Date,
        months: number,
        numSaltBeds: number,
        yieldRatio: number,
    ): MonthlyProductionForecast {
        const forecasts: MonthlyForecast[] = [];
        let totalProduction = 0;

        // Use pure arithmetic to avoid Date mutation bugs
        const baseYear = startDate.getFullYear();
        const baseMonth = startDate.getMonth(); // 0-11

        for (let monthOffset = 0; monthOffset < months; monthOffset++) {
            // Calculate target year and month using arithmetic (no Date mutation)
            const totalMonths = baseMonth + monthOffset;
            const targetYear = baseYear + Math.floor(totalMonths / 12);
            const targetMonth = totalMonths % 12; // 0-11
            const mNum = targetMonth + 1; // 1-12 for formula lookup
            const monthStr = `${targetYear}-${String(mNum).padStart(2, '0')}`;

            console.log('month loop:', { monthOffset, targetYear, targetMonth, mNum,
                wx: this.constants.historical_weather[mNum.toString()] });

            const { expected, lower95, upper95 } =
                this.forecastMonth(mNum, numSaltBeds, yieldRatio);

            forecasts.push({
                month: monthStr,
                month_number: monthOffset + 1,
                production_forecast: expected,
                lower_bound: lower95,
                upper_bound: upper95,
                season: this.getSeasonForMonth(mNum),
            });

            totalProduction += expected;
        }

        // Calculate end month using same arithmetic
        const totalEndMonths = baseMonth + months - 1;
        const endYear = baseYear + Math.floor(totalEndMonths / 12);
        const endMNum = (totalEndMonths % 12) + 1; // 1-12

        return {
            forecast_type: 'monthly_production',
            forecast_period: `${months}_months`,
            forecast_start_month: `${baseYear}-${String(baseMonth + 1).padStart(2, '0')}`,
            forecast_end_month: `${endYear}-${String(endMNum).padStart(2, '0')}`,
            total_months: forecasts.length,
            total_production: totalProduction,
            forecasts,
        };
    }

    // ─── Generate seasonal production aggregation from monthly forecasts ─────

    private generateSeasonalProduction(
        monthlyForecast: MonthlyProductionForecast,
    ): SeasonalProduction {
        const seasons: Record<string, SeasonData> = {};

        for (const forecast of monthlyForecast.forecasts) {
            const season = forecast.season;
            if (!seasons[season]) {
                seasons[season] = {
                    months_count: 0,
                    total_production: 0,
                    months: [],
                };
            }
            seasons[season].months_count += 1;
            seasons[season].total_production += forecast.production_forecast;
            seasons[season].months.push({
                month: forecast.month,
                production: forecast.production_forecast,
            });
        }

        return {
            forecast_type: 'seasonal_production',
            forecast_period: '12_months',
            seasons,
        };
    }
}
