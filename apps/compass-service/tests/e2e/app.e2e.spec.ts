import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HarvestPlanModule } from '../../src/app/harvest-plan/harvest-plan.module';
import { HarvestPlanController } from '../../src/app/harvest-plan/harvest-plan.controller';
import { HarvestPlan, HarvestPlanSchema } from '../../src/app/harvest-plan/schemas/harvest-plan.schema';

describe('Compass Service E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/compass-test';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri),
        MongooseModule.forFeature([
          { name: HarvestPlan.name, schema: HarvestPlanSchema },
        ]),
        HarvestPlanModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('HarvestPlanController (gRPC)', () => {
    let controller: HarvestPlanController;

    beforeEach(() => {
      controller = moduleRef.get<HarvestPlanController>(HarvestPlanController);
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should create a harvest plan', async () => {
      const createPlanDto = {
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
      };

      const result = await controller.CreatePlan(createPlanDto);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan created successfully');
      expect(result.data).toBeDefined();
      expect(result.data.userId).toBe(createPlanDto.userId);
      expect(result.data.saltBeds).toBe(createPlanDto.saltBeds);
    });

    it('should retrieve harvest plans', async () => {
      const result = await controller.GetPlans({});

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plans retrieved successfully');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should retrieve harvest plans with filters', async () => {
      const result = await controller.GetPlans({ userId: 'test-user-123' });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should retrieve harvest plans with pagination', async () => {
      const result = await controller.GetPlans({ page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(10);
    });

    it('should update a harvest plan', async () => {
      // First create a plan
      const createResult = await controller.CreatePlan({
        userId: 'test-user-update',
        saltBeds: 5,
        harvestStatus: 0,
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      });

      expect(createResult.success).toBe(true);
      const planId = createResult.data._id;

      // Then update it
      const updateResult = await controller.UpdatePlan({
        id: planId,
        saltBeds: 8,
        harvestStatus: 2,
      });

      expect(updateResult).toBeDefined();
      expect(updateResult.success).toBe(true);
      expect(updateResult.message).toBe('Harvest plan updated successfully');
      expect(updateResult.data.saltBeds).toBe(8);
    });

    it('should delete a harvest plan', async () => {
      // First create a plan
      const createResult = await controller.CreatePlan({
        userId: 'test-user-delete',
        saltBeds: 5,
        harvestStatus: 0,
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      });

      expect(createResult.success).toBe(true);
      const planId = createResult.data._id;

      // Then delete it
      const deleteResult = await controller.DeletePlan({ id: planId });

      expect(deleteResult).toBeDefined();
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toBe('Harvest plan deleted successfully');

      // Verify it's deleted
      const getResult = await controller.GetPlan({ id: planId });
      expect(getResult.success).toBe(false);
      expect(getResult.message).toBe('Harvest plan not found');
    });

    it('should handle errors gracefully for non-existent plans', async () => {
      const result = await controller.GetPlan({ id: 'nonexistent-id-12345' });

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to retrieve harvest plan');
    });

    it('should validate harvest status enum', async () => {
      const createResult = await controller.CreatePlan({
        userId: 'test-user-status',
        saltBeds: 5,
        harvestStatus: 3, // DISPOSED
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
    });

    it('should filter by status correctly', async () => {
      // Create plans with different statuses
      await controller.CreatePlan({
        userId: 'test-filter',
        saltBeds: 5,
        harvestStatus: 0, // FRESHER
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      });

      await controller.CreatePlan({
        userId: 'test-filter',
        saltBeds: 5,
        harvestStatus: 2, // HARVESTED
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      });

      const result = await controller.GetPlans({
        userId: 'test-filter',
        status: 'FRESHER',
      });

      expect(result.success).toBe(true);
      expect(result.data.every((plan: any) => plan.harvestStatus === 0)).toBe(true);
    });
  });
});
