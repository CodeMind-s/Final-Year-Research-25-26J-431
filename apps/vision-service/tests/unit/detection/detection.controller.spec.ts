import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DetectionController } from '../../../src/app/detection/detection.controller';
import { DetectionService } from '../../../src/app/detection/detection.service';
import { InferenceService } from '../../../src/app/inference/inference.service';
import { WhitenessService } from '../../../src/app/inference/whiteness.service';
import { ROIService } from '../../../src/app/roi/roi.service';
import { BatchService } from '../../../src/app/batch/batch.service';
import { DetectionSession } from '../../../src/app/detection/schemas/detection-session.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TEST_USER_ID,
  TEST_SESSION_ID,
  TEST_BATCH_ID,
  DEFAULT_ROI,
  createMockDetectionResult,
  createMockDetectionDocument,
  createMockSessionDocument,
} from '../helpers/test-data.helper';

describe('DetectionController', () => {
  let controller: DetectionController;
  let detectionService: jest.Mocked<DetectionService>;
  let inferenceService: jest.Mocked<InferenceService>;
  let whitenessService: jest.Mocked<WhitenessService>;
  let roiService: jest.Mocked<ROIService>;
  let batchService: jest.Mocked<BatchService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let sessionModel: any;

  beforeEach(async () => {
    const mockDetectionService = {
      create: jest.fn().mockResolvedValue(createMockDetectionDocument()),
      findAll: jest.fn().mockResolvedValue({
        data: [createMockDetectionDocument()],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      }),
      findOne: jest.fn().mockResolvedValue(createMockDetectionDocument()),
      remove: jest.fn().mockResolvedValue({ success: true }),
      incrementSessionStats: jest.fn().mockResolvedValue(undefined),
    };

    const mockInferenceService = {
      runInference: jest.fn().mockResolvedValue(createMockDetectionResult()),
      getModelStatus: jest.fn().mockReturnValue({ loaded: true, path: 'model.onnx' }),
    };

    const mockWhitenessService = {
      calculateWhiteness: jest.fn().mockResolvedValue([
        { x: 0.1, y: 0.2, width: 0.15, height: 0.1, classId: 1, className: 'pure', confidence: 0.9, color: '#22c55e', insideROI: true, whitenessPercentage: 85, qualityScore: 85 },
      ]),
      calculateAggregateStats: jest.fn().mockReturnValue({ avgWhiteness: 85, avgQualityScore: 85 }),
      calculateROIAggregateStats: jest.fn().mockReturnValue({ avgWhiteness: 85, avgQualityScore: 85 }),
    };

    const mockROIService = {
      getDefaultROI: jest.fn().mockReturnValue(DEFAULT_ROI),
      calculateROIStats: jest.fn().mockReturnValue({
        pureCount: 1, impureCount: 0, unwantedCount: 0, totalCount: 1, purityPercentage: 100,
      }),
      markBoxesWithROI: jest.fn().mockReturnValue([
        { x: 0.1, y: 0.2, width: 0.15, height: 0.1, classId: 1, className: 'pure', confidence: 0.9, color: '#22c55e', insideROI: true },
      ]),
    };

    const mockBatchService = {
      setCurrentBatchSnapshot: jest.fn().mockResolvedValue(undefined),
      getCurrentBatchStats: jest.fn().mockResolvedValue({
        pureCount: 5, impureCount: 2, unwantedCount: 1, totalCount: 8, purityPercentage: 71.43, frameCount: 10, avgWhiteness: 80, avgQualityScore: 70,
      }),
    };

    sessionModel = jest.fn().mockImplementation((dto) => {
      const doc = createMockSessionDocument(dto);
      return doc;
    });
    sessionModel.findById = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DetectionController],
      providers: [
        { provide: DetectionService, useValue: mockDetectionService },
        { provide: InferenceService, useValue: mockInferenceService },
        { provide: WhitenessService, useValue: mockWhitenessService },
        { provide: ROIService, useValue: mockROIService },
        { provide: BatchService, useValue: mockBatchService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getModelToken(DetectionSession.name), useValue: sessionModel },
      ],
    }).compile();

    controller = module.get<DetectionController>(DetectionController);
    detectionService = module.get(DetectionService);
    inferenceService = module.get(InferenceService);
    whitenessService = module.get(WhitenessService);
    roiService = module.get(ROIService);
    batchService = module.get(BatchService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('processFrame', () => {
    it('should run full inference pipeline and return response', async () => {
      const result = await controller.processFrame({
        imageData: Buffer.from('fake-image'),
        user_id: TEST_USER_ID,
      });

      expect(inferenceService.runInference).toHaveBeenCalled();
      expect(roiService.getDefaultROI).toHaveBeenCalled();
      expect(roiService.calculateROIStats).toHaveBeenCalled();
      expect(roiService.markBoxesWithROI).toHaveBeenCalled();
      // whitenessService.calculateWhiteness is only called when shouldSave is true
      expect(whitenessService.calculateWhiteness).not.toHaveBeenCalled();

      expect(result).toHaveProperty('frameId');
      expect(result).toHaveProperty('pureCount');
      expect(result).toHaveProperty('roiPureCount');
      expect(result).toHaveProperty('boundingBoxes');
    });

    it('should use provided ROI instead of default', async () => {
      const customROI = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
      await controller.processFrame({
        imageData: Buffer.from('fake-image'),
        roi: customROI,
      });

      expect(roiService.getDefaultROI).not.toHaveBeenCalled();
      expect(roiService.calculateROIStats).toHaveBeenCalledWith(
        expect.any(Array),
        customROI,
      );
    });

    it('should save detection when saveDetection=true and batchId provided', async () => {
      await controller.processFrame({
        imageData: Buffer.from('fake-image'),
        saveDetection: true,
        batchId: TEST_BATCH_ID,
        sessionId: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'detection.created',
        expect.objectContaining({
          sessionId: TEST_SESSION_ID,
          batchId: TEST_BATCH_ID,
        }),
      );
      expect(batchService.getCurrentBatchStats).toHaveBeenCalledWith(TEST_BATCH_ID);
    });

    it('should not save detection when saveDetection is false', async () => {
      await controller.processFrame({
        imageData: Buffer.from('fake-image'),
        saveDetection: false,
      });

      expect(detectionService.create).not.toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create session with default ROI', async () => {
      const result = await controller.createSession({
        user_id: TEST_USER_ID,
      });

      expect(roiService.getDefaultROI).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('startTime');
    });

    it('should create session with custom ROI', async () => {
      const customROI = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
      const result = await controller.createSession({
        user_id: TEST_USER_ID,
        roi: customROI,
      });

      expect(roiService.getDefaultROI).not.toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('endSession', () => {
    it('should set endTime and calculate avgPurityPercent', async () => {
      const mockSession = createMockSessionDocument({
        totalPureCount: 10,
        totalImpureCount: 5,
        totalUnwantedCount: 2,
      });
      sessionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSession),
      });

      const result = await controller.endSession({ sessionId: TEST_SESSION_ID });

      expect(result).toHaveProperty('endTime');
      expect(result).toHaveProperty('avgPurityPercent');
    });

    it('should throw when session not found', async () => {
      sessionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        controller.endSession({ sessionId: 'nonexistent' }),
      ).rejects.toThrow();
    });
  });

  describe('getSession', () => {
    it('should return formatted session response', async () => {
      const mockSession = createMockSessionDocument();
      sessionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSession),
      });

      const result = await controller.getSession({ sessionId: TEST_SESSION_ID });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('roi');
    });

    it('should throw when session not found', async () => {
      sessionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        controller.getSession({ sessionId: 'nonexistent' }),
      ).rejects.toThrow();
    });
  });

  describe('getDetections', () => {
    it('should delegate to detection service and map response', async () => {
      const result = await controller.getDetections({
        page: 1,
        limit: 20,
        user_id: TEST_USER_ID,
      });

      expect(detectionService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ userId: TEST_USER_ID }),
      );
      expect(result).toHaveProperty('detections');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('getDetection', () => {
    it('should return single detection wrapped in object', async () => {
      const result = await controller.getDetection({ id: 'test-id' });

      expect(detectionService.findOne).toHaveBeenCalledWith('test-id');
      expect(result).toHaveProperty('detection');
    });
  });

  describe('deleteDetection', () => {
    it('should delegate to detection service', async () => {
      const result = await controller.deleteDetection({ id: 'test-id' });

      expect(detectionService.remove).toHaveBeenCalledWith('test-id');
      expect(result).toEqual({ success: true, message: 'Detection deleted successfully' });
    });
  });
});
