import { Test, TestingModule } from '@nestjs/testing';
import { BatchController } from '../../../src/app/batch/batch.controller';
import { BatchService } from '../../../src/app/batch/batch.service';
import {
  TEST_USER_ID,
  TEST_SESSION_ID,
  TEST_BATCH_ID,
  DEFAULT_ROI,
} from '../helpers/test-data.helper';

describe('BatchController', () => {
  let controller: BatchController;
  let batchService: jest.Mocked<BatchService>;

  const mockBatchSummary = {
    id: TEST_BATCH_ID,
    userId: TEST_USER_ID,
    batchNumber: 1,
    startTime: new Date(),
    endTime: null,
    pureCount: 5,
    impureCount: 2,
    unwantedCount: 1,
    totalCount: 8,
    purityPercentage: 71.43,
    frameCount: 10,
    roi: DEFAULT_ROI,
    avgWhiteness: 80,
    avgQualityScore: 70,
    sessionId: TEST_SESSION_ID,
  };

  beforeEach(async () => {
    const mockService = {
      createBatch: jest.fn().mockResolvedValue(mockBatchSummary),
      endBatch: jest.fn().mockResolvedValue({ ...mockBatchSummary, endTime: new Date() }),
      getBatch: jest.fn().mockResolvedValue(mockBatchSummary),
      getAllBatches: jest.fn().mockResolvedValue({ batches: [mockBatchSummary], total: 1 }),
      getSessionBatches: jest.fn().mockResolvedValue([mockBatchSummary]),
      getBatchTrends: jest.fn().mockResolvedValue([{ batchNumber: 1, purityPercentage: 71.43 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchController],
      providers: [
        { provide: BatchService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<BatchController>(BatchController);
    batchService = module.get(BatchService);
  });

  describe('createBatch', () => {
    it('should create batch with default ROI when none provided', async () => {
      const result = await controller.createBatch({
        sessionId: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
      });

      expect(batchService.createBatch).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
        TEST_USER_ID,
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('batchNumber');
    });

    it('should create batch with custom ROI', async () => {
      const customROI = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
      await controller.createBatch({
        sessionId: TEST_SESSION_ID,
        roi: customROI,
      });

      expect(batchService.createBatch).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        customROI,
        undefined,
      );
    });
  });

  describe('endBatch', () => {
    it('should delegate to batch service', async () => {
      const result = await controller.endBatch({ batchId: TEST_BATCH_ID });

      expect(batchService.endBatch).toHaveBeenCalledWith(TEST_BATCH_ID);
      expect(result).toHaveProperty('endTime');
    });
  });

  describe('getBatch', () => {
    it('should return batch response', async () => {
      const result = await controller.getBatch({ batchId: TEST_BATCH_ID });

      expect(batchService.getBatch).toHaveBeenCalledWith(TEST_BATCH_ID);
      expect(result).toHaveProperty('id');
    });

    it('should throw when batch not found', async () => {
      batchService.getBatch.mockResolvedValueOnce(null);

      await expect(
        controller.getBatch({ batchId: 'nonexistent' }),
      ).rejects.toThrow();
    });
  });

  describe('getAllBatches', () => {
    it('should return batches array', async () => {
      const result = await controller.getAllBatches({ page: 1, limit: 20 });

      expect(result).toHaveProperty('batches');
      expect(result.batches).toHaveLength(1);
    });

    it('should default page and limit', async () => {
      await controller.getAllBatches({});

      expect(batchService.getAllBatches).toHaveBeenCalledWith(
        1, 20, undefined, undefined,
      );
    });
  });

  describe('getSessionBatches', () => {
    it('should return session batches', async () => {
      const result = await controller.getSessionBatches({
        sessionId: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
      });

      expect(batchService.getSessionBatches).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        TEST_USER_ID,
      );
      expect(result).toHaveProperty('batches');
    });
  });

  describe('getBatchTrends', () => {
    it('should return trends array', async () => {
      const result = await controller.getBatchTrends({
        sessionId: TEST_SESSION_ID,
      });

      expect(batchService.getBatchTrends).toHaveBeenCalledWith(
        TEST_SESSION_ID,
        undefined,
      );
      expect(result).toHaveProperty('trends');
    });
  });
});
