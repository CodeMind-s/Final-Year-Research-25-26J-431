import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BatchService } from '../../../src/app/batch/batch.service';
import { Batch } from '../../../src/app/detection/schemas/batch.schema';
import { DetectionSession } from '../../../src/app/detection/schemas/detection-session.schema';
import { createMockModel } from '../helpers/mock-model.helper';
import {
  TEST_USER_ID,
  TEST_SESSION_ID,
  TEST_BATCH_ID,
  DEFAULT_ROI,
  createMockBatchDocument,
} from '../helpers/test-data.helper';

describe('BatchService', () => {
  let service: BatchService;
  let batchModel: any;
  let sessionModel: any;

  beforeEach(async () => {
    batchModel = createMockModel();
    sessionModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        { provide: getModelToken(Batch.name), useValue: batchModel },
        { provide: getModelToken(DetectionSession.name), useValue: sessionModel },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
  });

  describe('createBatch', () => {
    it('should create a batch with correct batchNumber', async () => {
      // No previous batches
      batchModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      const savedBatch = createMockBatchDocument({ batchNumber: 1 });
      batchModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedBatch),
      }));
      sessionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.createBatch(TEST_SESSION_ID, DEFAULT_ROI, TEST_USER_ID);

      expect(result.batchNumber).toBe(1);
      expect(result.id).toBeDefined();
    });

    it('should increment batchNumber based on last batch', async () => {
      batchModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({ batchNumber: 3 }),
        }),
      });
      const savedBatch = createMockBatchDocument({ batchNumber: 4 });
      batchModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(savedBatch),
      }));
      sessionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.createBatch(TEST_SESSION_ID, DEFAULT_ROI);

      expect(result.batchNumber).toBe(4);
    });

    it('should increment session totalBatches', async () => {
      batchModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      batchModel.mockImplementation((dto) => ({
        ...dto,
        save: jest.fn().mockResolvedValue(createMockBatchDocument()),
      }));
      sessionModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.createBatch(TEST_SESSION_ID, DEFAULT_ROI);

      expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        { $inc: { totalBatches: 1 } },
      );
    });
  });

  describe('endBatch', () => {
    it('should set endTime and return batch summary', async () => {
      const endedBatch = createMockBatchDocument({ endTime: new Date() });
      batchModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(endedBatch),
      });

      const result = await service.endBatch(TEST_BATCH_ID);

      expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TEST_BATCH_ID,
        { $set: { endTime: expect.any(Date) } },
        { new: true },
      );
      expect(result.endTime).toBeDefined();
    });

    it('should throw NotFoundException when batch not found', async () => {
      batchModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.endBatch('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBatch', () => {
    it('should return batch summary', async () => {
      const mockBatch = createMockBatchDocument();
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBatch),
      });

      const result = await service.getBatch(TEST_BATCH_ID);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should return null when not found', async () => {
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getBatch('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getAllBatches', () => {
    it('should return paginated batches', async () => {
      const mockBatches = [createMockBatchDocument(), createMockBatchDocument()];
      batchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockBatches),
            }),
          }),
        }),
      });
      batchModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.getAllBatches(1, 20);

      expect(result.batches).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply sessionId and userId filters', async () => {
      batchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      batchModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.getAllBatches(1, 20, TEST_SESSION_ID, TEST_USER_ID);

      expect(batchModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(Types.ObjectId),
          userId: expect.any(Types.ObjectId),
        }),
      );
    });
  });

  describe('getSessionBatches', () => {
    it('should return batches sorted by batchNumber descending', async () => {
      const mockBatches = [
        createMockBatchDocument({ batchNumber: 2 }),
        createMockBatchDocument({ batchNumber: 1 }),
      ];
      batchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockBatches),
        }),
      });

      const result = await service.getSessionBatches(TEST_SESSION_ID);

      expect(result).toHaveLength(2);
      expect(batchModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(Types.ObjectId),
        }),
      );
    });
  });

  describe('setCurrentBatchSnapshot', () => {
    it('should update counts and increment frameCount', async () => {
      batchModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.setCurrentBatchSnapshot(TEST_BATCH_ID, 5, 2, 1, 8, 75.5, 60.2);

      expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TEST_BATCH_ID,
        {
          $set: {
            pureCount: 5,
            impureCount: 2,
            unwantedCount: 1,
            totalCount: 8,
            purityPercentage: expect.closeTo(71.43, 1),
            avgWhiteness: 75.5,
            avgQualityScore: 60.2,
          },
          $inc: { frameCount: 1 },
        },
      );
    });

    it('should calculate purity as pure/(pure+impure)*100', async () => {
      batchModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.setCurrentBatchSnapshot(TEST_BATCH_ID, 3, 1, 0, 4);

      expect(batchModel.findByIdAndUpdate).toHaveBeenCalledWith(
        TEST_BATCH_ID,
        expect.objectContaining({
          $set: expect.objectContaining({
            purityPercentage: 75, // 3/(3+1)*100
          }),
        }),
      );
    });
  });

  describe('getCurrentBatchStats', () => {
    it('should return stats with calculated purityPercentage', async () => {
      const mockBatch = createMockBatchDocument({
        pureCount: 8,
        impureCount: 2,
        unwantedCount: 1,
        totalCount: 11,
        frameCount: 5,
        avgWhiteness: 80,
        avgQualityScore: 70,
      });
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBatch),
      });

      const result = await service.getCurrentBatchStats(TEST_BATCH_ID);

      expect(result).toBeDefined();
      expect(result.purityPercentage).toBe(80); // 8/(8+2)*100
      expect(result.frameCount).toBe(5);
    });

    it('should return null when batch not found', async () => {
      batchModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getCurrentBatchStats('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getBatchTrends', () => {
    it('should return only ended batches sorted by batchNumber ascending', async () => {
      const mockBatches = [
        { batchNumber: 1, purityPercentage: 60 },
        { batchNumber: 2, purityPercentage: 75 },
      ];
      batchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockBatches),
          }),
        }),
      });

      const result = await service.getBatchTrends(TEST_SESSION_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ batchNumber: 1, purityPercentage: 60 });
      expect(result[1]).toEqual({ batchNumber: 2, purityPercentage: 75 });

      // Should filter by endTime not null
      expect(batchModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          endTime: { $ne: null },
        }),
      );
    });

    it('should default to 100 purity when null', async () => {
      batchModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { batchNumber: 1, purityPercentage: null },
            ]),
          }),
        }),
      });

      const result = await service.getBatchTrends(TEST_SESSION_ID);
      expect(result[0].purityPercentage).toBe(100);
    });
  });
});
