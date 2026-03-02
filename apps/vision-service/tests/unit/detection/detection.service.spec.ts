import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DetectionService } from '../../../src/app/detection/detection.service';
import { Detection } from '../../../src/app/detection/schemas/detection.schema';
import { DetectionSession } from '../../../src/app/detection/schemas/detection-session.schema';
import { createMockModel } from '../helpers/mock-model.helper';
import {
  TEST_USER_ID,
  TEST_SESSION_ID,
  TEST_DETECTION_ID,
  createMockDetectionDocument,
} from '../helpers/test-data.helper';

describe('DetectionService', () => {
  let service: DetectionService;
  let detectionModel: any;
  let sessionModel: any;

  beforeEach(async () => {
    detectionModel = createMockModel();
    sessionModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetectionService,
        { provide: getModelToken(Detection.name), useValue: detectionModel },
        { provide: getModelToken(DetectionSession.name), useValue: sessionModel },
      ],
    }).compile();

    service = module.get<DetectionService>(DetectionService);
  });

  describe('create', () => {
    it('should save a detection with calculated fields', async () => {
      const savedDoc = createMockDetectionDocument();
      detectionModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedDoc),
      }));

      const dto = {
        userId: TEST_USER_ID,
        frameWidth: 640,
        frameHeight: 480,
        processingTimeMs: 45,
        boundingBoxes: [
          { x: 0.1, y: 0.2, width: 0.15, height: 0.1, classId: 1, className: 'pure', confidence: 0.9 },
          { x: 0.3, y: 0.3, width: 0.15, height: 0.1, classId: 0, className: 'impure', confidence: 0.8 },
        ],
      };

      const result = await service.create(dto);

      expect(detectionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          pureCount: 1,
          impureCount: 1,
          unwantedCount: 0,
          totalCount: 2,
          purityPercentage: 50,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should convert userId to ObjectId', async () => {
      const savedDoc = createMockDetectionDocument();
      detectionModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedDoc),
      }));

      await service.create({
        userId: TEST_USER_ID,
        frameWidth: 640,
        frameHeight: 480,
        processingTimeMs: 45,
        boundingBoxes: [],
      });

      expect(detectionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
        }),
      );
    });

    it('should convert sessionId and batchId to ObjectId when provided', async () => {
      const sessionId = new Types.ObjectId().toString();
      const batchId = new Types.ObjectId().toString();
      const savedDoc = createMockDetectionDocument();
      detectionModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedDoc),
      }));

      await service.create({
        userId: TEST_USER_ID,
        frameWidth: 640,
        frameHeight: 480,
        processingTimeMs: 45,
        sessionId,
        batchId,
        boundingBoxes: [],
      });

      expect(detectionModel).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(Types.ObjectId),
          batchId: expect.any(Types.ObjectId),
        }),
      );
    });

    it('should set purity to 100 when no salt crystals are detected', async () => {
      const savedDoc = createMockDetectionDocument({ purityPercentage: 100 });
      detectionModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedDoc),
      }));

      await service.create({
        userId: TEST_USER_ID,
        frameWidth: 640,
        frameHeight: 480,
        processingTimeMs: 45,
        boundingBoxes: [
          { x: 0.1, y: 0.2, width: 0.1, height: 0.1, classId: 2, className: 'unwanted', confidence: 0.7 },
        ],
      });

      expect(detectionModel).toHaveBeenCalledWith(
        expect.objectContaining({ purityPercentage: 100 }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results with metadata', async () => {
      const mockDocs = [createMockDetectionDocument(), createMockDetectionDocument()];
      detectionModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockDocs),
            }),
          }),
        }),
      });
      detectionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should apply userId filter', async () => {
      detectionModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      detectionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ userId: TEST_USER_ID });

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
        }),
      );
    });

    it('should apply date range filters', async () => {
      detectionModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      detectionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        }),
      );
    });

    it('should apply purity range filters', async () => {
      detectionModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      detectionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ minPurity: 50, maxPurity: 90 });

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          purityPercentage: { $gte: 50, $lte: 90 },
        }),
      );
    });

    it('should apply sessionId filter', async () => {
      const sessionId = new Types.ObjectId().toString();
      detectionModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      detectionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ sessionId });

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(Types.ObjectId),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return detection by id', async () => {
      const mockDoc = createMockDetectionDocument();
      detectionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockDoc),
      });

      const result = await service.findOne(TEST_DETECTION_ID);
      expect(result).toEqual(mockDoc);
    });

    it('should throw NotFoundException when not found', async () => {
      detectionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete detection by id', async () => {
      detectionModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(createMockDetectionDocument()),
      });

      const result = await service.remove(TEST_DETECTION_ID);
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when not found', async () => {
      detectionModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementSessionStats', () => {
    it('should call findByIdAndUpdate with $inc on session model', async () => {
      sessionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.incrementSessionStats(TEST_SESSION_ID, 2, 1, 0);

      expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        {
          $inc: {
            totalFrames: 1,
            totalPureCount: 2,
            totalImpureCount: 1,
            totalUnwantedCount: 0,
          },
        },
      );
    });
  });
});
