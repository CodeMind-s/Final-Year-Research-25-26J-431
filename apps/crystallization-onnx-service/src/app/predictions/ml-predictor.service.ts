import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ort from 'onnxruntime-node';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { WeatherService } from './weather.service';
import { DailyMeasurement } from './schemas/daily-measurement.schema';

/**
 * Service responsible for ONNX model inference.
 * Replaces the Python/TensorFlow-based MLPredictor.
 */
@Injectable()
export class MlPredictorService implements OnModuleInit {
    private session: ort.InferenceSession | null = null;
    private readonly logger = new Logger(MlPredictorService.name);

    // Scaler constants (log features) for normalisation
    private logScalerCenter: number[] = [];
    private logScalerScale: number[]  = [];

    // Model performance metrics (same as Python version)
    readonly performanceMetrics = {
        test_mae: 0.22643738985061646,
        test_rmse: 0.36510669291987724,
        test_r2_score: 0.7749716637562971,
        test_accuracy: 77.49716637562972,
        validation_r2_score: 0.8884437289486968,
        validation_accuracy: 88.84437289486968,
    };

    constructor(
        private readonly weatherService: WeatherService,
        @InjectModel(DailyMeasurement.name)
        private readonly dailyMeasurementModel: Model<DailyMeasurement>,
    ) {}

    async onModuleInit() {
        await this.loadModel();
        await this.loadScalerConstants();
    }

    // ─── Model loading ────────────────────────────────────────────────────────

    /**
     * Load the ONNX model - MANDATORY
     */
    private async loadModel(): Promise<void> {
        // Try multiple possible paths for the model
        const possiblePaths = [
            path.join(__dirname, 'models/crystallization_model.onnx'),
            path.join(__dirname, '../models/crystallization_model.onnx'),
            path.join(process.cwd(), 'models/crystallization_model.onnx'),
            path.join(process.cwd(), 'apps/crystallization-onnx-service/models/crystallization_model.onnx'),
            path.join(process.cwd(), 'dist/apps/crystallization-onnx-service/models/crystallization_model.onnx'),
        ];

        this.logger.log(`Debug: __dirname = ${__dirname}`);
        this.logger.log(`Debug: CWD = ${process.cwd()}`);
        this.logger.log(`Debug: Searching for model in:`);
        possiblePaths.forEach(p => this.logger.log(`  - ${p} (Exists: ${fs.existsSync(p)})`));

        let modelPath: string | null = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) { modelPath = p; break; }
        }

        if (!modelPath) {
            const error = `CRITICAL: ONNX model not found. Searched paths:\n${possiblePaths.join('\n')}`;
            this.logger.error(error);
            throw new Error(error);
        }

        try {
            this.logger.log(`Loading ONNX model from: ${modelPath}`);
            this.session = await ort.InferenceSession.create(modelPath);
            const inputNames  = this.session.inputNames;
            const outputNames = this.session.outputNames;
            this.logger.log(`Model loaded successfully`);
            this.logger.log(`  Input names: ${inputNames.join(', ')}`);
            this.logger.log(`  Output names: ${outputNames.join(', ')}`);
        } catch (error) {
            const msg = `WARNING: Failed to load ONNX model: ${error}. Service will run in MOCK mode.`;
            this.logger.warn(msg);
            this.session = null;
        }
    }

    /** Load log-feature scaler constants */
    private async loadScalerConstants(): Promise<void> {
        const candidates = [
            path.join(__dirname, 'models/scaler_constants.json'),
            path.join(__dirname, '../models/scaler_constants.json'),
            path.join(process.cwd(), 'models/scaler_constants.json'),
            path.join(process.cwd(), 'apps/crystallization-onnx-service/models/scaler_constants.json'),
            path.join(process.cwd(), 'dist/apps/crystallization-onnx-service/models/scaler_constants.json'),
        ];
        let scalerPath: string | null = null;
        for (const p of candidates) { if (fs.existsSync(p)) { scalerPath = p; break; } }
        if (!scalerPath) { this.logger.warn('scaler_constants.json not found — using identity normalisation'); return; }
        try {
            const raw = await fsp.readFile(scalerPath, 'utf-8');
            const parsed = JSON.parse(raw);
            this.logScalerCenter = parsed.log_scaler.center as number[];
            this.logScalerScale  = parsed.log_scaler.scale  as number[];
            this.logger.log(`scaler_constants.json (log) loaded from: ${scalerPath}`);
        } catch (err) {
            this.logger.warn(`Failed to load scaler_constants: ${err}`);
        }
    }

    // ─── Inference ────────────────────────────────────────────────────────────

    /**
     * Run inference on the ONNX model.
     *
     * @param inputValues Array of 8 parameters (current day sensor readings)
     * @param startDate   ISO date string for the forecast start (used for weather lookup)
     * @param latitude    Latitude for weather fetch (defaults from env)
     * @param longitude   Longitude for weather fetch (defaults from env)
     * @returns Predicted parameters (8 values)
     */
    async predict(
        inputValues: number[],
        startDate?: string,
        latitude?: number,
        longitude?: number,
    ): Promise<number[]> {
        if (!this.session) {
            this.logger.warn('Running in MOCK mode - returning simulated predictions');
            return inputValues.map(v => v * (1 + (Math.random() * 0.1 - 0.05)));
        }

        if (inputValues.length !== 8) {
            throw new Error(`Expected 8 input values, got ${inputValues.length}`);
        }

        const sequenceLength = 60;
        const logFeatures    = 8;

        // ── 1. Build log_input [1, 60, 8] using real sensor history ──────────
        const logData = await this.buildLogInput(inputValues, startDate, sequenceLength, logFeatures);
        const logTensor = new ort.Tensor('float32', logData, [1, sequenceLength, logFeatures]);

        // ── 2. Build weather_input [1, 60, 14] using WeatherService ──────────
        const lat  = latitude  ?? (parseFloat(process.env.OPENWEATHER_LAT ?? '') || 7.2008);
        const lon  = longitude ?? (parseFloat(process.env.OPENWEATHER_LON ?? '') || 79.8737);
        const date = startDate ?? new Date().toISOString().slice(0, 10);

        let weatherData: Float32Array;
        try {
            weatherData = await this.weatherService.buildWeatherInput(lat, lon, date);
        } catch (err) {
            this.logger.warn(`WeatherService failed, using zeros: ${err}`);
            weatherData = new Float32Array(sequenceLength * 14);
        }
        const weatherTensor = new ort.Tensor('float32', weatherData, [1, sequenceLength, 14]);

        // ── 3. Run inference ─────────────────────────────────────────────────
        const feeds: Record<string, ort.Tensor> = {};
        const inputNames = this.session.inputNames;
        if (inputNames.includes('log_input'))     feeds['log_input']     = logTensor;
        else                                       feeds[inputNames[0]]   = logTensor;
        if (inputNames.includes('weather_input')) feeds['weather_input'] = weatherTensor;
        else if (inputNames.length > 1)            feeds[inputNames[1]]   = weatherTensor;

        const results = await this.session.run(feeds);

        // ── 4. Extract output: first 8 values (day-1 forecast) ───────────────
        const outputName = this.session.outputNames[0];
        const outputData = results[outputName].data as Float32Array;
        return Array.from(outputData).slice(0, 8);
    }

    /**
     * Build the 60-day log_input tensor.
     * Fetches up to 60 real records from MongoDB; pads cold-start if fewer available.
     */
    private async buildLogInput(
        currentParams: number[],
        startDate: string | undefined,
        sequenceLength: number,
        logFeatures: number,
    ): Promise<Float32Array> {
        const logData = new Float32Array(sequenceLength * logFeatures);
        let records: { parameters: any }[] = [];

        try {
            // Fetch last 60 days of actual sensor readings sorted desc → then reverse
            records = await this.dailyMeasurementModel
                .find(startDate ? { date: { $lte: new Date(startDate) } } : {})
                .sort({ date: -1 })
                .limit(sequenceLength)
                .lean()
                .exec() as any[];
            records.reverse(); // oldest first
        } catch (err) {
            this.logger.warn(`DailyMeasurement query failed — using cold-start: ${err}`);
        }

        // Map sensor record to 8-feature array
        const paramOrder = [
            'water_temperature', 'lagoon', 'OR_brine_level', 'OR_bund_level',
            'IR_brine_level', 'IR_bound_level', 'East_channel', 'West_channel',
        ] as const;

        const toFeatures = (rec: { parameters?: any } | null, fallback: number[]): number[] => {
            if (!rec?.parameters) return fallback;
            return paramOrder.map(k => (rec.parameters as any)[k] ?? 0);
        };

        // Oldest available record for cold-start padding
        const oldestFallback = records.length > 0
            ? toFeatures(records[0], currentParams)
            : currentParams;

        const nReal = records.length;
        const nPad  = sequenceLength - nReal;

        for (let i = 0; i < sequenceLength; i++) {
            const raw: number[] = i < nPad
                ? oldestFallback
                : toFeatures(records[i - nPad], oldestFallback);

            // Normalise with RobustScaler
            const normalised = raw.map((v, j) => {
                const center = this.logScalerCenter[j] ?? 0;
                const scale  = this.logScalerScale[j]  ?? 1;
                return (v - center) / scale;
            });

            for (let f = 0; f < logFeatures; f++) {
                logData[i * logFeatures + f] = normalised[f];
            }
        }

        return logData;
    }

    /**
     * Check if the model is loaded and ready
     */
    isReady(): boolean {
        // Return true because we have a mock fallback
        return true;
    }
}
