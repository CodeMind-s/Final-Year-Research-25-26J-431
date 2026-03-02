import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsController } from '../../../src/app/statistics/statistics.controller';
import { StatisticsService } from '../../../src/app/statistics/statistics.service';
import { TEST_USER_ID } from '../helpers/test-data.helper';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let statisticsService: jest.Mocked<StatisticsService>;

  const mockSummary = {
    totalDetections: 100,
    totalPure: 60,
    totalImpure: 30,
    totalUnwanted: 10,
    averagePurity: 66.67,
    averageProcessingTime: 42.5,
    detectionsPerHour: 12.5,
    periodStart: '2025-06-01',
    periodEnd: '2025-06-30',
  };

  beforeEach(async () => {
    const mockService = {
      getSummary: jest.fn().mockResolvedValue(mockSummary),
      getHourlyStats: jest.fn().mockResolvedValue([
        { hour: 10, detections: 5, pureCount: 3, impureCount: 2, unwantedCount: 0, avgPurity: 60 },
      ]),
      getDailyStats: jest.fn().mockResolvedValue([
        { date: '2025-06-15', detections: 10, pureCount: 6, impureCount: 3, unwantedCount: 1, avgPurity: 66.67 },
      ]),
      getTrends: jest.fn().mockResolvedValue([
        { timestamp: '2025-06-15T10:00:00Z', purity: 70 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        { provide: StatisticsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<StatisticsController>(StatisticsController);
    statisticsService = module.get(StatisticsService);
  });

  describe('getStatsSummary', () => {
    it('should delegate to statistics service', async () => {
      const result = await controller.getStatsSummary({
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        user_id: TEST_USER_ID,
      });

      expect(statisticsService.getSummary).toHaveBeenCalledWith(
        '2025-06-01',
        '2025-06-30',
        TEST_USER_ID,
      );
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getStatsHourly', () => {
    it('should return stats wrapped in object', async () => {
      const result = await controller.getStatsHourly({
        date: '2025-06-15',
        user_id: TEST_USER_ID,
      });

      expect(statisticsService.getHourlyStats).toHaveBeenCalledWith(
        '2025-06-15',
        TEST_USER_ID,
      );
      expect(result).toHaveProperty('stats');
      expect(result.stats).toHaveLength(1);
    });
  });

  describe('getStatsDaily', () => {
    it('should return stats wrapped in object with default limit', async () => {
      const result = await controller.getStatsDaily({
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      });

      expect(statisticsService.getDailyStats).toHaveBeenCalledWith(
        '2025-06-01',
        '2025-06-30',
        30,
        undefined,
      );
      expect(result).toHaveProperty('stats');
    });

    it('should pass custom limit', async () => {
      await controller.getStatsDaily({ limit: 7 });

      expect(statisticsService.getDailyStats).toHaveBeenCalledWith(
        undefined,
        undefined,
        7,
        undefined,
      );
    });
  });

  describe('getStatsTrends', () => {
    it('should return trends wrapped in object with defaults', async () => {
      const result = await controller.getStatsTrends({});

      expect(statisticsService.getTrends).toHaveBeenCalledWith(
        'daily',
        30,
        undefined,
      );
      expect(result).toHaveProperty('trends');
    });

    it('should pass custom period and limit', async () => {
      await controller.getStatsTrends({
        period: 'hourly',
        limit: 24,
        user_id: TEST_USER_ID,
      });

      expect(statisticsService.getTrends).toHaveBeenCalledWith(
        'hourly',
        24,
        TEST_USER_ID,
      );
    });
  });
});
