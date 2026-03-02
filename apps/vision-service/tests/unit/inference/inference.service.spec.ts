jest.mock('onnxruntime-node', () => {
  const mockRunFn = jest.fn();
  return {
    __esModule: true,
    __mockRun: mockRunFn,
    InferenceSession: {
      create: jest.fn().mockResolvedValue({
        inputNames: ['images'],
        outputNames: ['output0'],
        run: mockRunFn,
      }),
    },
    Tensor: jest.fn().mockImplementation((type: string, data: any, dims: number[]) => ({
      type,
      data,
      dims,
    })),
  };
});

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { InferenceService } from '../../../src/app/inference/inference.service';
import { PreprocessingService } from '../../../src/app/inference/preprocessing.service';
import { PostprocessingService } from '../../../src/app/inference/postprocessing.service';
import * as ort from 'onnxruntime-node';

// Access the mock run function from the mocked module
const mockRun = (ort as any).__mockRun as jest.Mock;

describe('InferenceService', () => {
  let service: InferenceService;

  const mockPreprocess = jest.fn().mockResolvedValue({
    tensor: new Float32Array(1 * 3 * 320 * 320),
    originalWidth: 640,
    originalHeight: 480,
  });

  const mockProcessOutput = jest.fn().mockReturnValue([
    {
      x: 0.1, y: 0.2, width: 0.15, height: 0.1,
      classId: 1, className: 'pure', confidence: 0.9, color: '#22c55e',
    },
    {
      x: 0.3, y: 0.3, width: 0.15, height: 0.1,
      classId: 0, className: 'impure', confidence: 0.8, color: '#ef4444',
    },
  ]);

  beforeEach(async () => {
    process.env.VISION_MODEL_PATH = 'test-model.onnx';
    process.env.VISION_INPUT_SIZE = '320';

    jest.clearAllMocks();

    mockRun.mockResolvedValue({
      output0: {
        data: new Float32Array(7 * 100),
        dims: [1, 7, 100],
      },
    });

    // Re-setup the create mock after clearAllMocks
    (ort.InferenceSession.create as jest.Mock).mockResolvedValue({
      inputNames: ['images'],
      outputNames: ['output0'],
      run: mockRun,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InferenceService,
        {
          provide: PreprocessingService,
          useValue: { preprocess: mockPreprocess },
        },
        {
          provide: PostprocessingService,
          useValue: { processOutput: mockProcessOutput },
        },
      ],
    }).compile();

    service = module.get<InferenceService>(InferenceService);
  });

  afterEach(() => {
    delete process.env.VISION_MODEL_PATH;
    delete process.env.VISION_INPUT_SIZE;
  });

  describe('onModuleInit', () => {
    it('should load the ONNX model successfully', async () => {
      await service.onModuleInit();

      expect(ort.InferenceSession.create).toHaveBeenCalledWith(
        'test-model.onnx',
        expect.objectContaining({ executionProviders: ['cpu'] }),
      );
    });

    it('should perform warmup after loading', async () => {
      await service.onModuleInit();

      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('should throw when model loading fails', async () => {
      (ort.InferenceSession.create as jest.Mock).mockRejectedValueOnce(
        new Error('Model not found'),
      );

      await expect(service.onModuleInit()).rejects.toThrow('Model not found');
    });
  });

  describe('getModelStatus', () => {
    it('should return not loaded before init', () => {
      const status = service.getModelStatus();
      expect(status.loaded).toBe(false);
      expect(status.path).toBe('test-model.onnx');
    });

    it('should return loaded after successful init', async () => {
      await service.onModuleInit();

      const status = service.getModelStatus();
      expect(status.loaded).toBe(true);
      expect(status.path).toBe('test-model.onnx');
    });
  });

  describe('runInference', () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockRun.mockClear();
      mockRun.mockResolvedValue({
        output0: {
          data: new Float32Array(7 * 100),
          dims: [1, 7, 100],
        },
      });
    });

    it('should orchestrate preprocess, model run, and postprocess', async () => {
      const imageBuffer = Buffer.from('fake-image');
      await service.runInference(imageBuffer);

      expect(mockPreprocess).toHaveBeenCalledWith(imageBuffer);
      expect(mockRun).toHaveBeenCalledTimes(1);
      expect(mockProcessOutput).toHaveBeenCalledWith(
        expect.any(Float32Array),
        640,
        480,
      );
    });

    it('should return detection result with correct counts', async () => {
      const result = await service.runInference(Buffer.from('fake-image'));

      expect(result.pureCount).toBe(1);
      expect(result.impureCount).toBe(1);
      expect(result.unwantedCount).toBe(0);
      expect(result.totalCount).toBe(2);
    });

    it('should calculate purity percentage', async () => {
      const result = await service.runInference(Buffer.from('fake-image'));
      expect(result.purityPercentage).toBe(50);
    });

    it('should include frameId, timestamp, and processingTimeMs', async () => {
      const result = await service.runInference(Buffer.from('fake-image'));

      expect(result.frameId).toBe('test-uuid');
      expect(result.timestamp).toEqual(expect.any(Number));
      expect(result.processingTimeMs).toEqual(expect.any(Number));
    });

    it('should include frame dimensions from preprocessing', async () => {
      const result = await service.runInference(Buffer.from('fake-image'));

      expect(result.frameWidth).toBe(640);
      expect(result.frameHeight).toBe(480);
    });

    it('should throw when model is not loaded', async () => {
      const module = await Test.createTestingModule({
        providers: [
          InferenceService,
          { provide: PreprocessingService, useValue: { preprocess: mockPreprocess } },
          { provide: PostprocessingService, useValue: { processOutput: mockProcessOutput } },
        ],
      }).compile();
      const freshService = module.get<InferenceService>(InferenceService);

      await expect(freshService.runInference(Buffer.from('fake'))).rejects.toThrow(
        'Model not loaded',
      );
    });
  });
});
