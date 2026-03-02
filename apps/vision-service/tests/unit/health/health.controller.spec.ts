import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../../src/app/health/health.controller';
import { InferenceService } from '../../../src/app/inference/inference.service';

describe('HealthController', () => {
  let controller: HealthController;
  let inferenceService: jest.Mocked<InferenceService>;

  beforeEach(async () => {
    const mockInferenceService = {
      getModelStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: InferenceService, useValue: mockInferenceService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    inferenceService = module.get(InferenceService);
  });

  describe('getHealth', () => {
    it('should return healthy status when model is loaded', () => {
      inferenceService.getModelStatus.mockReturnValue({
        loaded: true,
        path: 'models/best.onnx',
      });

      const result = controller.getHealth();

      expect(result).toEqual({
        modelLoaded: true,
        modelPath: 'models/best.onnx',
        status: 'healthy',
      });
    });

    it('should return unhealthy status when model is not loaded', () => {
      inferenceService.getModelStatus.mockReturnValue({
        loaded: false,
        path: 'models/best.onnx',
      });

      const result = controller.getHealth();

      expect(result).toEqual({
        modelLoaded: false,
        modelPath: 'models/best.onnx',
        status: 'unhealthy',
      });
    });
  });
});
