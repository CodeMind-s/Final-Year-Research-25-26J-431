import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StatisticsService } from '../../../src/app/statistics/statistics.service';
import { Detection } from '../../../src/app/detection/schemas/detection.schema';
import { createMockModel } from '../helpers/mock-model.helper';
import { TEST_USER_ID } from '../helpers/test-data.helper';

describe('StatisticsService', () => {
  let service: StatisticsService;
  let detectionModel: any;

  beforeEach(async () => {
    detectionModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: getModelToken(Detection.name), useValue: detectionModel },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
  });

  describe('getSummary', () => {
    it('should return totals and averages', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const mockDetections = [
        { pureCount: 5, impureCount: 2, unwantedCount: 1, purityPercentage: 71.43, processingTimeMs: 40, timestamp: oneHourAgo },
        { pureCount: 3, impureCount: 1, unwantedCount: 0, purityPercentage: 75, processingTimeMs: 50, timestamp: now },
      ];

      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockDetections),
        }),
      });

      const result = await service.getSummary();

      expect(result.totalDetections).toBe(2);
      expect(result.totalPure).toBe(8);
      expect(result.totalImpure).toBe(3);
      expect(result.totalUnwanted).toBe(1);
      expect(result.averagePurity).toBeCloseTo(73.22, 1);
      expect(result.averageProcessingTime).toBe(45);
      expect(result.detectionsPerHour).toBeGreaterThan(0);
    });

    it('should return empty stats for no detections', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getSummary();

      expect(result.totalDetections).toBe(0);
      expect(result.averagePurity).toBe(100);
      expect(result.detectionsPerHour).toBe(0);
    });

    it('should apply date range filter', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.getSummary('2025-01-01', '2025-12-31');

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        }),
      );
    });

    it('should apply user filter', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.getSummary(undefined, undefined, TEST_USER_ID);

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Object),
        }),
      );
    });
  });

  describe('getHourlyStats', () => {
    it('should return 24 hour buckets', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getHourlyStats();

      expect(result).toHaveLength(24);
      expect(result[0].hour).toBe(0);
      expect(result[23].hour).toBe(23);
    });

    it('should aggregate per-hour data', async () => {
      const testDate = new Date('2025-06-15T10:30:00Z');
      const mockDetections = [
        { pureCount: 5, impureCount: 2, unwantedCount: 1, purityPercentage: 71, timestamp: testDate },
        { pureCount: 3, impureCount: 1, unwantedCount: 0, purityPercentage: 75, timestamp: testDate },
      ];

      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockDetections),
        }),
      });

      const result = await service.getHourlyStats('2025-06-15');
      const hourBucket = result.find((h) => h.hour === testDate.getHours());

      expect(hourBucket.detections).toBe(2);
      expect(hourBucket.pureCount).toBe(8);
      expect(hourBucket.impureCount).toBe(3);
    });

    it('should return 100 avgPurity for empty hours', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getHourlyStats();
      expect(result.every((h) => h.avgPurity === 100)).toBe(true);
    });
  });

  describe('getDailyStats', () => {
    it('should group by date and return daily aggregation', async () => {
      const mockDetections = [
        { pureCount: 5, impureCount: 2, unwantedCount: 1, purityPercentage: 71, timestamp: new Date('2025-06-15T10:00:00Z') },
        { pureCount: 3, impureCount: 1, unwantedCount: 0, purityPercentage: 75, timestamp: new Date('2025-06-15T14:00:00Z') },
        { pureCount: 4, impureCount: 3, unwantedCount: 2, purityPercentage: 57, timestamp: new Date('2025-06-16T08:00:00Z') },
      ];

      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockDetections),
          }),
        }),
      });

      const result = await service.getDailyStats('2025-06-15', '2025-06-16');

      expect(result).toHaveLength(2);
      const day15 = result.find((d) => d.date === '2025-06-15');
      expect(day15.detections).toBe(2);
      expect(day15.pureCount).toBe(8);
    });

    it('should apply limit for default date range', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getDailyStats(undefined, undefined, 7);

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('getTrends', () => {
    it('should return purity trends sorted by timestamp', async () => {
      const mockDetections = [
        { purityPercentage: 70, timestamp: new Date('2025-06-15T10:00:00Z') },
        { purityPercentage: 80, timestamp: new Date('2025-06-15T11:00:00Z') },
      ];

      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockDetections),
          }),
        }),
      });

      const result = await service.getTrends('daily', 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        timestamp: expect.any(String),
        purity: 70,
      });
    });

    it('should calculate correct start date for hourly period', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getTrends('hourly', 24);

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.objectContaining({ $gte: expect.any(Date) }),
        }),
      );
    });

    it('should calculate correct start date for weekly period', async () => {
      detectionModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getTrends('weekly', 4);

      expect(detectionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.objectContaining({ $gte: expect.any(Date) }),
        }),
      );
    });
  });
});
