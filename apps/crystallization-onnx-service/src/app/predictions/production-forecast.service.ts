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
            const raw = await fs.readFile(this.constantsPath, 'utf-8');
            this.constants = JSON.parse(raw);
            this.logger.log(`calibration_constants.json loaded from: ${this.constantsPath}`);
        } catch (err) {
            this.logger.error(`Failed to load calibration_constants.json: ${err}`);
            throw err;
        }
    }

    // ─── Yield ratio ────────────────────────────────────────────────────────

    private computeYieldRatio(
        history: ProductionHistoryItem[],
        numSaltBeds: number,
    ): { yieldRatio: number; ratios: number[]; nMonths: number } {
        if (!history || history.length === 0) {
            return { yieldRatio: 1.0, ratios: [], nMonths: 0 };
        }
        const ratios: number[] = [];
        for (const item of history) {
            const monthNum = new Date(item.month).getMonth() + 1;
            const wx = this.constants.historical_weather[monthNum.toString()];
            if (!wx) continue;
            const mSin = Math.sin(2 * Math.PI * monthNum / 12);
            const mCos = Math.cos(2 * Math.PI * monthNum / 12);
            const formulaPred = Math.max(1,
                this.constants.beds_coef  * numSaltBeds
                + this.constants.rain_coef * wx.avg_rain_mm
                + this.constants.temp_coef * wx.avg_temp_c
                + this.constants.sin_coef  * mSin
                + this.constants.cos_coef  * mCos
                + this.constants.intercept,
            );
            ratios.push(item.production_volume / formulaPred);
        }
        const sorted = [...ratios].sort((a, b) => a - b);
        const mid    = Math.floor(sorted.length / 2);
        const yieldRatio = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
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

    private forecastMonth(
        monthNum: number,
        numSaltBeds: number,
        yieldRatio: number,
    ): { expected: number; lower95: number; upper95: number } {
        const wx = this.constants.historical_weather[monthNum.toString()];
        const mSin = Math.sin(2 * Math.PI * monthNum / 12);
        const mCos = Math.cos(2 * Math.PI * monthNum / 12);
        const base = Math.max(0,
            this.constants.beds_coef  * numSaltBeds
            + this.constants.rain_coef * wx.avg_rain_mm
            + this.constants.temp_coef * wx.avg_temp_c
            + this.constants.sin_coef  * mSin
            + this.constants.cos_coef  * mCos
            + this.constants.intercept,
        );
        const expected = base * yieldRatio;
        return {
            expected,
            lower95: Math.max(0, expected - this.constants.pi_half_width),
            upper95: expected + this.constants.pi_half_width,
        };
    }

    private getSeasonForMonth(monthNum: number): string {
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
        };
    }

    // ─── Public forecast entry point ─────────────────────────────────────────

    async forecast(params: {
        currentDate: string;
        numSaltBeds: number;
        productionHistory: ProductionHistoryItem[];
    }): Promise<ProductionForecastResult> {
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
        for (let i = 1; i <= 2; i++) {
            const target = new Date(date.getFullYear(), date.getMonth() + i, 1);
            const mNum   = target.getMonth() + 1;
            const { expected, lower95, upper95 } =
                this.forecastMonth(mNum, params.numSaltBeds, yieldRatio);
            calibratedMonthlyForecast.push({
                month:  target.toISOString().slice(0, 10),
                season: this.getSeasonForMonth(mNum),
                lower95, expected, upper95,
                type: 'PREDICTED',
            });
        }

        const confidence = this.computeConfidence({
            yieldRatio, yieldStatus, decliningTrend, improvingTrend,
            nHistoryMonths: nMonths,
        });

        return {
            calibratedMonthlyForecast,
            seasonalForecast: [currentSeasonForecast, nextSeasonForecast],
            confidence,
        };
    }
}
