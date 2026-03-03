import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import type { ClientKafka } from '@nestjs/microservices';
import MultivariateLinearRegression from 'ml-regression-multivariate-linear';
import { ProductionForecastService } from './production-forecast.service';
import { ActualMonthlyProduction } from './schemas/actual-monthly-production.schema';
import type { RetrainingResponse } from './dtos/interfaces';

@Injectable()
export class RetrainingService implements OnModuleInit {
    private readonly logger = new Logger(RetrainingService.name);
    private auditConnected = false;

    /** Resolve calibration_constants.json using same multi-path strategy */
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
        return candidates[0];
    })();

    constructor(
        private readonly productionForecastService: ProductionForecastService,
        @InjectModel(ActualMonthlyProduction.name)
        private readonly actualMonthlyProductionModel: Model<ActualMonthlyProduction>,
        @Inject('AUDIT_LOG_SERVICE') private readonly auditLogClient: ClientKafka,
    ) {}

    async onModuleInit() {
        // Connect Kafka client (best-effort — do not fail startup)
        try {
            await this.auditLogClient.connect();
            this.auditConnected = true;
        } catch (err) {
            this.logger.warn(`Kafka audit client failed to connect: ${err}. Audit logging disabled.`);
        }

        // Watch calibration_constants.json for changes and hot-reload
        try {
            const chokidar = await import('chokidar');
            const watcher = chokidar.default.watch(this.constantsPath, {
                persistent: false,
                ignoreInitial: true,
                awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
            });
            watcher.on('change', async () => {
                this.logger.log('calibration_constants.json changed — reloading constants');
                try {
                    await this.productionForecastService.loadConstants();
                    this.logger.log('calibration_constants.json reloaded');
                } catch (err) {
                    this.logger.error(`Failed to reload constants: ${err}`);
                }
            });
            this.logger.log(`Watching ${this.constantsPath} for changes`);
        } catch (err) {
            this.logger.warn(`Could not start file watcher: ${err}`);
        }
    }

    /** Midnight on the 1st of every month */
    @Cron('0 0 1 * *')
    async scheduledRetrain() {
        this.logger.log('Monthly retraining triggered by cron');
        await this.runRetraining('cron');
    }

    async runRetraining(triggeredBy: string): Promise<RetrainingResponse> {
        this.logger.log(`Retraining started — triggered by: ${triggeredBy}`);

        // ── STEP 1: Read current constants ──────────────────────────────────
        let current: any;
        try {
            current = JSON.parse(await fs.readFile(this.constantsPath, 'utf-8'));
        } catch (err) {
            const msg = `Cannot read calibration_constants.json: ${err}`;
            this.logger.error(msg);
            return { success: false, message: msg, newR2Score: 0, newHoldoutMae: 0, newPiHalfWidth: 0, nMonthsUsed: 0, lastRetrained: '' };
        }

        // ── STEP 2: Fetch all production data from MongoDB ───────────────────
        let records: ActualMonthlyProduction[];
        try {
            records = await this.actualMonthlyProductionModel.find().sort({ month: 1 }).exec();
        } catch (err) {
            const msg = `MongoDB query failed: ${err}`;
            this.logger.error(msg);
            return { success: false, message: msg, newR2Score: 0, newHoldoutMae: 0, newPiHalfWidth: 0, nMonthsUsed: 0, lastRetrained: '' };
        }

        const n = records.length;
        if (n < 12) {
            const msg = `Insufficient data for retraining: ${n} months found, need at least 12`;
            this.logger.warn(msg);
            return { success: false, message: msg, newR2Score: 0, newHoldoutMae: 0, newPiHalfWidth: 0, nMonthsUsed: n, lastRetrained: '' };
        }

        // ── STEP 3: Build feature matrix X and target vector y ───────────────
        const buildFeatures = (rec: { month: string; production_volume?: number; num_salt_beds?: number }): number[] => {
            const monthNum = new Date(rec.month).getMonth() + 1;
            const wx = current.historical_weather[monthNum.toString()];
            const mSin = Math.sin(2 * Math.PI * monthNum / 12);
            const mCos = Math.cos(2 * Math.PI * monthNum / 12);
            return [
                (rec as any).num_salt_beds ?? current.historical_avg_beds,
                wx.avg_rain_mm,
                wx.avg_temp_c,
                mSin,
                mCos,
            ];
        };

        const X: number[][] = records.map(r => buildFeatures(r as any));
        const y: number[][] = records.map(r => [r.production_volume]);

        // ── STEP 4: Fit regression on all data ───────────────────────────────
        let regression: MultivariateLinearRegression;
        try {
            regression = new MultivariateLinearRegression(X, y);
        } catch (err) {
            const msg = `Regression fitting failed: ${err}`;
            this.logger.error(msg);
            return { success: false, message: msg, newR2Score: 0, newHoldoutMae: 0, newPiHalfWidth: 0, nMonthsUsed: n, lastRetrained: '' };
        }

        // Extract coefficients [beds, rain, temp, sin, cos] + intercept
        // ml-regression-multivariate-linear stores weights as this.weights (rows = outputs, cols = inputs+1)
        const weights     = (regression as any).weights as number[][];
        const coefRow     = weights[0];
        const bedsCoef    = coefRow[0];
        const rainCoef    = coefRow[1];
        const tempCoef    = coefRow[2];
        const sinCoef     = coefRow[3];
        const cosCoef     = coefRow[4];
        const intercept   = coefRow[5] ?? 0; // last column is bias/intercept

        // ── STEP 5: Compute residuals ─────────────────────────────────────────
        const k = 5; // number of features
        const predict = (row: number[]): number =>
            bedsCoef * row[0] + rainCoef * row[1] + tempCoef * row[2]
            + sinCoef * row[3] + cosCoef * row[4] + intercept;

        const residuals = records.map((r, i) => r.production_volume - predict(X[i]));
        const ssRes     = residuals.reduce((s, r) => s + r * r, 0);
        const residStd  = Math.sqrt(ssRes / Math.max(n - k - 1, 1));
        const piHalfWidth = 1.96 * residStd;

        // ── STEP 6: Holdout MAE (last 6 months) ──────────────────────────────
        const holdoutN = 6;
        const trainN   = n - holdoutN;
        let newHoldoutMae = 0;
        if (trainN >= 6) {
            const Xtrain = X.slice(0, trainN);
            const ytrain: number[][] = records.slice(0, trainN).map(r => [r.production_volume]);
            const regrHoldout = new MultivariateLinearRegression(Xtrain, ytrain);
            const wH     = (regrHoldout as any).weights as number[][];
            const cH     = wH[0];
            const predictH = (row: number[]) =>
                cH[0] * row[0] + cH[1] * row[1] + cH[2] * row[2]
                + cH[3] * row[3] + cH[4] * row[4] + (cH[5] ?? 0);

            const holdoutAbsErrors = records.slice(trainN).map((r, i) =>
                Math.abs(r.production_volume - predictH(X[trainN + i])),
            );
            newHoldoutMae = holdoutAbsErrors.reduce((a, b) => a + b, 0) / holdoutAbsErrors.length;
        }

        // ── STEP 7: R² score ─────────────────────────────────────────────────
        const yValues = records.map(r => r.production_volume);
        const yMean   = yValues.reduce((a, b) => a + b, 0) / n;
        const ssTot   = yValues.reduce((s, v) => s + (v - yMean) ** 2, 0);
        const r2      = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

        // ── STEP 8: Atomic write ─────────────────────────────────────────────
        const now = new Date().toISOString();
        const updated = {
            ...current,
            beds_coef:     bedsCoef,
            rain_coef:     rainCoef,
            temp_coef:     tempCoef,
            sin_coef:      sinCoef,
            cos_coef:      cosCoef,
            intercept,
            pi_half_width: piHalfWidth,
            resid_std:     residStd,
            r2_score:      r2,
            holdout_mae:   newHoldoutMae,
            n_months:      n,
            last_retrained: now,
        };

        const tmpPath = this.constantsPath + '.tmp';
        try {
            await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
            await fs.rename(tmpPath, this.constantsPath);
        } catch (writeErr) {
            // Clean up temp file if it exists, keep existing constants
            try { await fs.unlink(tmpPath); } catch { /* ignore */ }
            const msg = `Atomic write failed — existing constants preserved: ${writeErr}`;
            this.logger.error(msg);
            return { success: false, message: msg, newR2Score: r2, newHoldoutMae, newPiHalfWidth: piHalfWidth, nMonthsUsed: n, lastRetrained: '' };
        }

        // ── STEP 9: Log summary ───────────────────────────────────────────────
        this.logger.log(
            `Retraining complete.\n`
            + `  r2_score:     ${current.r2_score?.toFixed(4)} → ${r2.toFixed(4)}\n`
            + `  pi_half_width:${current.pi_half_width?.toFixed(2)} → ${piHalfWidth.toFixed(2)}\n`
            + `  holdout_mae:  ${current.holdout_mae?.toFixed(2)} → ${newHoldoutMae.toFixed(2)}\n`
            + `  n_months:     ${current.n_months} → ${n}`,
        );

        // ── STEP 10: Kafka audit log ──────────────────────────────────────────
        if (this.auditConnected) {
            try {
                this.auditLogClient.emit('create_audit_log', {
                    serviceName: 'crystallization-onnx-service',
                    action:      'MODEL_RETRAINED',
                    resourceType: 'calibration_constants',
                    details: JSON.stringify({
                        triggeredBy,
                        prevR2: current.r2_score,
                        newR2: r2,
                        prevHoldoutMae: current.holdout_mae,
                        newHoldoutMae,
                        nMonths: n,
                    }),
                    status: 'success',
                    timestamp: now,
                });
            } catch (kafkaErr) {
                this.logger.warn(`Kafka audit emit failed (non-fatal): ${kafkaErr}`);
            }
        }

        // ── STEP 11: Warn if R² < 0.80 ───────────────────────────────────────
        if (r2 < 0.80) {
            this.logger.warn(
                `Retraining produced low R² (${r2.toFixed(4)}) — check data quality`,
            );
        }

        return {
            success:       true,
            message:       `Retraining complete. R²=${r2.toFixed(4)}, MAE=${newHoldoutMae.toFixed(2)}, n=${n}`,
            newR2Score:    r2,
            newHoldoutMae,
            newPiHalfWidth: piHalfWidth,
            nMonthsUsed:   n,
            lastRetrained: now,
        };
    }

    /** Helper: emit audit log (same pattern as salt-production.service.ts) */
    private async emitAuditLog(data: {
        serviceName: string;
        action: string;
        resourceType: string;
        details?: string;
        status: 'success' | 'error';
    }): Promise<void> {
        if (!this.auditConnected) return;
        try {
            this.auditLogClient.emit('create_audit_log', {
                ...data,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            this.logger.warn(`Failed to emit audit log: ${err}`);
        }
    }
}
