import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { HarvestPlanModule } from '../../src/app/harvest-plan/harvest-plan.module';
import { HarvestPlanService } from '../../src/app/harvest-plan/harvest-plan.service';
import { HarvestPlan } from '../../src/app/harvest-plan/schemas/harvest-plan.schema';
import { DistributorOffer } from '../../src/app/distributor-offers/schemas/distributor-offer.schema';

describe('Compass Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let mongoServer: MongoMemoryServer;
  let harvestPlanModel: Model<HarvestPlan>;
  let distributorOfferModel: Model<DistributorOffer>;
  let harvestPlanService: HarvestPlanService;

  const createdIds: { harvestPlans: string[] } = {
    harvestPlans: [],
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        HarvestPlanModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    harvestPlanModel = moduleRef.get(getModelToken(HarvestPlan.name));
    distributorOfferModel = moduleRef.get(getModelToken(DistributorOffer.name));
    harvestPlanService = moduleRef.get(HarvestPlanService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.harvestPlans.length > 0) {
        await harvestPlanModel.deleteMany({
          _id: { $in: createdIds.harvestPlans },
        });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 15000);

  describe('HarvestPlan Lifecycle', () => {
    let planId: string;

    it('should create a harvest plan', async () => {
      const result = await harvestPlanService.CreatePlan({
        userId: 'test-user-123',
        saltBeds: 5,
        harvestStatus: 0,
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
        predictedProduction: 1000,
        actualProduction: 0,
        workerCount: 5,
        predictedProfit: 50000,
        actualProfit: 0,
        expenses: 0,
        earnings: 0,
        avgSellingPrice: 50,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan created successfully');
      expect(result.data).toBeDefined();
      expect(result.data.userId).toBe('test-user-123');
      expect(result.data.saltBeds).toBe(5);
      expect(result.data.harvestStatus).toBe(0); // FRESHER

      planId = result.data._id;
      createdIds.harvestPlans.push(planId);
    });

    it('should retrieve the plan by ID', async () => {
      const result = await harvestPlanService.GetPlan({ id: planId });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan retrieved successfully');
      expect(result.data._id).toBe(planId);
      expect(result.data.planPeriod).toBe(45);
    });

    it('should update the plan', async () => {
      const result = await harvestPlanService.UpdatePlan({
        id: planId,
        saltBeds: 8,
        harvestStatus: 2, // HARVESTED
        actualProduction: 500,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan updated successfully');
      expect(result.data.saltBeds).toBe(8);
      expect(result.data.harvestStatus).toBe(2); // HARVESTED
      expect(result.data.actualProduction).toBe(500);
    });

    it('should delete the plan', async () => {
      const result = await harvestPlanService.DeletePlan({ id: planId });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan deleted successfully');
      createdIds.harvestPlans = createdIds.harvestPlans.filter((id) => id !== planId);

      // Verify it's deleted
      const getResult = await harvestPlanService.GetPlan({ id: planId });
      expect(getResult.success).toBe(false);
      expect(getResult.message).toBe('Harvest plan not found');
    });
  });

  describe('HarvestPlan Queries', () => {
    beforeAll(async () => {
      // Seed test data
      const plans = [
        { userId: 'query-user', saltBeds: 3, harvestStatus: 0, planPeriod: 30, startDate: '2026-01-01T00:00:00Z' },
        { userId: 'query-user', saltBeds: 5, harvestStatus: 2, planPeriod: 45, startDate: '2026-02-01T00:00:00Z' },
        { userId: 'query-user', saltBeds: 7, harvestStatus: 0, planPeriod: 60, startDate: '2026-03-01T00:00:00Z' },
        { userId: 'other-user', saltBeds: 4, harvestStatus: 1, planPeriod: 30, startDate: '2026-01-15T00:00:00Z' },
      ];

      for (const plan of plans) {
        const result = await harvestPlanService.CreatePlan(plan);
        if (result.success) {
          createdIds.harvestPlans.push(result.data._id);
        }
      }
    });

    it('should list all plans', async () => {
      const result = await harvestPlanService.GetPlans({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plans retrieved successfully');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter by userId', async () => {
      const result = await harvestPlanService.GetPlans({ userId: 'query-user' });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data.every((p: any) => p.userId === 'query-user')).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await harvestPlanService.GetPlans({
        userId: 'query-user',
        status: 'FRESHER',
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data.every((p: any) => p.harvestStatus === 0)).toBe(true);
    });

    it('should apply pagination', async () => {
      const result = await harvestPlanService.GetPlans({ page: 1, limit: 2 });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent plan', async () => {
      const result = await harvestPlanService.GetPlan({ id: 'nonexistent-id-12345' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to retrieve harvest plan');
    });

    it('should return error when updating non-existent plan', async () => {
      const result = await harvestPlanService.UpdatePlan({
        id: '507f1f77bcf86cd799439011',
        saltBeds: 10,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Harvest plan not found');
    });

    it('should return error when deleting non-existent plan', async () => {
      const result = await harvestPlanService.DeletePlan({
        id: '507f1f77bcf86cd799439011',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Harvest plan not found');
    });
  });

  describe('DemandPrice', () => {
    beforeAll(async () => {
      // Seed distributor offers for demand/price tests
      await distributorOfferModel.create([
        { userId: 'dist-user-1', targetQuantity: 500, pricePerKilo: 40, totalInvestment: 20000, requirement: 'HIGH', status: 'PUBLISH', createdAt: new Date('2026-01-10') },
        { userId: 'dist-user-1', targetQuantity: 300, pricePerKilo: 45, totalInvestment: 13500, requirement: 'MEDIUM', status: 'PUBLISH', createdAt: new Date('2026-01-20') },
        { userId: 'dist-user-2', targetQuantity: 700, pricePerKilo: 50, totalInvestment: 35000, requirement: 'HIGH', status: 'PUBLISH', createdAt: new Date('2026-02-15') },
      ]);
    });

    it('should return demand and price data for a date range', async () => {
      const result = await harvestPlanService.GetDemandPrice({
        startMonth: '2026-01',
        endMonth: '2026-02',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Demand and price data retrieved successfully');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);

      const jan = result.data.find((d: any) => d.month === '2026-01');
      expect(jan).toBeDefined();
      expect(jan.totalDemand).toBe(800); // 500 + 300
    });

    it('should return empty for a range with no offers', async () => {
      const result = await harvestPlanService.GetDemandPrice({
        startMonth: '2025-01',
        endMonth: '2025-06',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });
});
