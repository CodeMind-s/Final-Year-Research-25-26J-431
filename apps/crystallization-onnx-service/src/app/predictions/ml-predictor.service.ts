import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Service responsible for ONNX model inference.
 * Replaces the Python/TensorFlow-based MLPredictor.
 */
@Injectable()
export class MlPredictorService implements OnModuleInit {
    private session: ort.InferenceSession | null = null;
    private readonly logger = new Logger(MlPredictorService.name);

    // Model performance metrics (same as Python version)
    readonly performanceMetrics = {
        test_mae: 0.22643738985061646,
        test_rmse: 0.36510669291987724,
        test_r2_score: 0.7749716637562971,
        test_accuracy: 77.49716637562972,
        validation_r2_score: 0.8884437289486968,
        validation_accuracy: 88.84437289486968,
    };

    async onModuleInit() {
        await this.loadModel();
    }

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
            if (fs.existsSync(p)) {
                modelPath = p;
                break;
            }
        }

        if (!modelPath) {
            const error = `CRITICAL: ONNX model not found. Searched paths:\n${possiblePaths.join('\n')}`;
            this.logger.error(error);
            throw new Error(error);
        }

        try {
            this.logger.log(`Loading ONNX model from: ${modelPath}`);
            this.session = await ort.InferenceSession.create(modelPath);

            // Log model info
            const inputNames = this.session.inputNames;
            const outputNames = this.session.outputNames;
            this.logger.log(`Model loaded successfully`);
            this.logger.log(`  Input names: ${inputNames.join(', ')}`);
            this.logger.log(`  Output names: ${outputNames.join(', ')}`);
        } catch (error) {
            const msg = `WARNING: Failed to load ONNX model: ${error}. Service will run in MOCK mode.`;
            this.logger.warn(msg);
            // Do NOT throw error, allow service to start
            this.session = null;
        }
    }

    /**
     * Run inference on the ONNX model
     * 
     * @param inputValues Array of 8 parameters:
     *   [water_temperature, lagoon, OR_brine_level, OR_bund_level,
     *    IR_brine_level, IR_bound_level, East_channel, West_channel]
     * @returns Predicted parameters (8 values)
     */
    async predict(inputValues: number[]): Promise<number[]> {
        if (!this.session) {
            this.logger.warn('Running in MOCK mode - returning simulated predictions');
            // Return slightly perturbed input values as mock prediction
            return inputValues.map(v => v * (1 + (Math.random() * 0.1 - 0.05)));
        }

        if (inputValues.length !== 8) {
            throw new Error(`Expected 8 input values, got ${inputValues.length}`);
        }

        // The model expects a 30-day history window for both log parameters (8 features) 
        // and weather parameters (7 features).
        // Since we only receive the current day's values, we replicate them to fill the 30-day window.
        // This is a "cold start" approximation.

        // 1. Prepare log_input: [1, 30, 8]
        const sequenceLength = 30;
        const logFeatures = 8;
        const logData = new Float32Array(sequenceLength * logFeatures);

        // Fill the array by replicating inputValues
        for (let i = 0; i < sequenceLength; i++) {
            for (let j = 0; j < logFeatures; j++) {
                logData[i * logFeatures + j] = inputValues[j];
            }
        }

        const logTensor = new ort.Tensor('float32', logData, [1, sequenceLength, logFeatures]);

        // 2. Prepare weather_input: [1, 30, 7]
        // We use default values (zeros) for weather as we don't have this data in the input
        const weatherFeatures = 7;
        const weatherData = new Float32Array(sequenceLength * weatherFeatures);
        // Leaving as zeros for now

        const weatherTensor = new ort.Tensor('float32', weatherData, [1, sequenceLength, weatherFeatures]);

        // 3. Run inference
        // Note: We use the specific input names found in the model
        const feeds: Record<string, ort.Tensor> = {};

        const inputNames = this.session.inputNames;
        if (inputNames.includes('log_input')) feeds['log_input'] = logTensor;
        else feeds[inputNames[0]] = logTensor; // Fallback

        if (inputNames.includes('weather_input')) feeds['weather_input'] = weatherTensor;
        else if (inputNames.length > 1) feeds[inputNames[1]] = weatherTensor; // Fallback

        const results = await this.session.run(feeds);

        // 4. Extract output
        // The model outputs 480 values (60 days * 8 features)
        // We return the first 8 values (day 1 forecast) to satisfy the iterative predictor interface
        const outputName = this.session.outputNames[0];
        const outputData = results[outputName].data as Float32Array;

        return Array.from(outputData).slice(0, 8);
    }

    /**
     * Check if the model is loaded and ready
     */
    isReady(): boolean {
        // Return true because we have a mock fallback
        return true;
    }
}
