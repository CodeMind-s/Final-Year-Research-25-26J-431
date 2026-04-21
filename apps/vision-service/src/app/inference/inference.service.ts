import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as ort from 'onnxruntime-node';
import { v4 as uuidv4 } from 'uuid';
import { PreprocessingService } from './preprocessing.service';
import { PostprocessingService } from './postprocessing.service';
import { DetectionResult } from '../common/interfaces/detection-result.interface';

@Injectable()
export class InferenceService implements OnModuleInit {
  private readonly logger = new Logger(InferenceService.name);
  private session: ort.InferenceSession | null = null;
  private readonly modelPath: string;
  private readonly inputSize: number;
  private isModelLoaded = false;

  constructor(
    private readonly preprocessingService: PreprocessingService,
    private readonly postprocessingService: PostprocessingService,
  ) {
    const int8Path = process.env.VISION_MODEL_PATH_INT8;
    this.modelPath = int8Path || process.env.VISION_MODEL_PATH || process.env.MODEL_PATH || 'apps/vision-service/models/best.onnx';
    this.inputSize = parseInt(process.env.VISION_INPUT_SIZE || process.env.INPUT_SIZE || '320', 10);
  }

  private getExecutionProviders(): string[] {
    const provider = process.env.VISION_EXECUTION_PROVIDER || 'cpu';
    const providers: string[] = [];

    switch (provider.toLowerCase()) {
      case 'cuda':
        providers.push('CUDAExecutionProvider');
        break;
      case 'tensorrt':
        providers.push('TensorrtExecutionProvider');
        break;
      case 'directml':
        providers.push('DmlExecutionProvider');
        break;
    }

    // Always include CPU as fallback
    providers.push('CPUExecutionProvider');
    return providers;
  }

  async onModuleInit() {
    await this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      this.logger.log(`Loading ONNX model from: ${this.modelPath}`);

      const executionProviders = this.getExecutionProviders();
      this.logger.log(`Using execution providers: ${executionProviders.join(', ')}`);

      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders,
        graphOptimizationLevel: 'all',
      });

      this.isModelLoaded = true;
      this.logger.log('ONNX model loaded successfully');
      this.logger.log(`Input names: ${this.session.inputNames}`);
      this.logger.log(`Output names: ${this.session.outputNames}`);

      await this.warmup();
    } catch (error) {
      this.logger.error(`Failed to load ONNX model: ${error.message}`);
      throw error;
    }
  }

  private async warmup(): Promise<void> {
    this.logger.log('Warming up model...');

    const dummyTensor = new Float32Array(1 * 3 * this.inputSize * this.inputSize);
    const inputTensor = new ort.Tensor('float32', dummyTensor, [
      1,
      3,
      this.inputSize,
      this.inputSize,
    ]);

    const inputName = this.session!.inputNames[0];
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };

    await this.session!.run(feeds);
    this.logger.log('Model warmup complete');
  }

  getModelStatus(): { loaded: boolean; path: string } {
    return {
      loaded: this.isModelLoaded,
      path: this.modelPath,
    };
  }

  async runInference(imageBuffer: Buffer): Promise<DetectionResult> {
    if (!this.session || !this.isModelLoaded) {
      throw new Error('Model not loaded');
    }

    const startTime = performance.now();

    const { tensor, originalWidth, originalHeight } =
      await this.preprocessingService.preprocess(imageBuffer);

    const inputTensor = new ort.Tensor('float32', tensor, [
      1,
      3,
      this.inputSize,
      this.inputSize,
    ]);

    const inputName = this.session.inputNames[0];
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
    const results = await this.session.run(feeds);

    const outputName = this.session.outputNames[0];
    const outputTensor = results[outputName];
    const outputData = outputTensor.data as Float32Array;

    this.logger.debug(`Output tensor shape: ${outputTensor.dims}`);
    this.logger.debug(`Output data length: ${outputData.length}`);

    const boundingBoxes = this.postprocessingService.processOutput(
      outputData,
      originalWidth,
      originalHeight,
    );

    const endTime = performance.now();
    const processingTimeMs = endTime - startTime;

    const impureCount = boundingBoxes.filter((b) => b.classId === 0).length;
    const pureCount = boundingBoxes.filter((b) => b.classId === 1).length;
    const unwantedCount = boundingBoxes.filter((b) => b.classId === 2).length;
    const totalCount = boundingBoxes.length;
    const saltCount = pureCount + impureCount;
    const purityPercentage =
      saltCount > 0 ? (pureCount / saltCount) * 100 : 100;

    return {
      frameId: uuidv4(),
      timestamp: Date.now(),
      processingTimeMs,
      pureCount,
      impureCount,
      unwantedCount,
      totalCount,
      purityPercentage,
      boundingBoxes,
      frameWidth: originalWidth,
      frameHeight: originalHeight,
    };
  }
}
