import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HarvestPlanService } from '../../src/app/harvest-plan/harvest-plan.service';
import { HarvestPlan, HarvestStatus } from '../../src/app/harvest-plan/schemas/harvest-plan.schema';

describe('HarvestPlanService', () => {
  let service: HarvestPlanService;
  let model: Model<HarvestPlan>;

  const mockHarvestPlan = {
    _id: '507f1f77bcf86cd799439011',
    userId: 'user123',
    saltBeds: 5,
    harvestStatus: HarvestStatus.FRESHER,
    planPeriod: 45,
    startDate: new Date('2026-02-15'),
    endDate: new Date('2026-04-01'),
    predictedProduction: 1000,
    actualProduction: 0,
    workerCount: 5,
    predictedProfit: 50000,
    actualProfit: 0,
    expenses: 0,
    earnings: 0,
    avgSellingPrice: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHarvestPlanModel = {
    new: jest.fn().mockResolvedValue(mockHarvestPlan),
    constructor: jest.fn().mockResolvedValue(mockHarvestPlan),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    exec: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HarvestPlanService,
        {
          provide: getModelToken(HarvestPlan.name),
          useValue: mockHarvestPlanModel,
        },
      ],
    }).compile();

    service = module.get<HarvestPlanService>(HarvestPlanService);
    model = module.get<Model<HarvestPlan>>(getModelToken(HarvestPlan.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CreatePlan', () => {
    it('should create a harvest plan successfully', async () => {
      const createPlanDto = {
        userId: 'user123',
        saltBeds: 5,
        harvestStatus: 0, // FRESHER
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

      const saveMock = jest.fn().mockResolvedValue(mockHarvestPlan);
      mockHarvestPlanModel.save = saveMock;

      // Mock the constructor to return an object with save method
      jest.spyOn(model, 'constructor' as any).mockImplementation(() => ({
        save: saveMock,
        ...mockHarvestPlan,
      }));

      const result = await service.CreatePlan(createPlanDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan created successfully');
    });

    it('should handle errors when creating plan', async () => {
      const createPlanDto = {
        userId: 'user123',
        saltBeds: 5,
        harvestStatus: 0,
        planPeriod: 45,
        startDate: '2026-02-15T00:00:00Z',
      };

      jest.spyOn(model, 'constructor' as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.CreatePlan(createPlanDto);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create harvest plan');
    });
  });

  describe('GetPlan', () => {
    it('should retrieve a harvest plan by ID', async () => {
      const getPlanDto = { id: '507f1f77bcf86cd799439011' };

      mockHarvestPlanModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockHarvestPlan),
      });

      const result = await service.GetPlan(getPlanDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan retrieved successfully');
      expect(mockHarvestPlanModel.findById).toHaveBeenCalledWith(getPlanDto.id);
    });

    it('should return error when plan not found', async () => {
      const getPlanDto = { id: 'nonexistent' };

      mockHarvestPlanModel.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.GetPlan(getPlanDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Harvest plan not found');
    });
  });

  describe('GetPlans', () => {
    it('should retrieve all harvest plans without filters', async () => {
      const mockPlans = [mockHarvestPlan];

      mockHarvestPlanModel.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlans),
      });

      const result = await service.GetPlans({});

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plans retrieved successfully');
      expect(result.data).toHaveLength(1);
      expect(mockHarvestPlanModel.find).toHaveBeenCalledWith({});
    });

    it('should filter harvest plans by userId', async () => {
      const getPlansDto = { userId: 'user123' };
      const mockPlans = [mockHarvestPlan];

      mockHarvestPlanModel.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlans),
      });

      const result = await service.GetPlans(getPlansDto);

      expect(result.success).toBe(true);
      expect(mockHarvestPlanModel.find).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should apply pagination correctly', async () => {
      const getPlansDto = { page: 2, limit: 10 };
      const mockPlans = [mockHarvestPlan];

      const skipMock = jest.fn().mockReturnThis();
      const limitMock = jest.fn().mockReturnThis();
      const execMock = jest.fn().mockResolvedValue(mockPlans);

      mockHarvestPlanModel.find = jest.fn().mockReturnValue({
        skip: skipMock,
        limit: limitMock,
        exec: execMock,
      });

      const result = await service.GetPlans(getPlansDto);

      expect(result.success).toBe(true);
      expect(skipMock).toHaveBeenCalledWith(10); // (page 2 - 1) * limit 10
      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('should filter by status', async () => {
      const getPlansDto = { status: 'FRESHER' };
      const mockPlans = [mockHarvestPlan];

      mockHarvestPlanModel.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockPlans),
      });

      const result = await service.GetPlans(getPlansDto);

      expect(result.success).toBe(true);
      expect(mockHarvestPlanModel.find).toHaveBeenCalledWith({
        harvestStatus: 'FRESHER',
      });
    });
  });

  describe('UpdatePlan', () => {
    it('should update a harvest plan successfully', async () => {
      const updatePlanDto = {
        id: '507f1f77bcf86cd799439011',
        saltBeds: 8,
        harvestStatus: 2, // HARVESTED
      };

      mockHarvestPlanModel.findById = jest.fn().mockResolvedValue(mockHarvestPlan);
      mockHarvestPlanModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockHarvestPlan, saltBeds: 8 }),
      });

      const result = await service.UpdatePlan(updatePlanDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan updated successfully');
    });

    it('should return error when updating non-existent plan', async () => {
      const updatePlanDto = {
        id: 'nonexistent',
        saltBeds: 8,
      };

      mockHarvestPlanModel.findById = jest.fn().mockResolvedValue(null);
      mockHarvestPlanModel.findByIdAndUpdate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.UpdatePlan(updatePlanDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Harvest plan not found');
    });
  });

  describe('DeletePlan', () => {
    it('should delete a harvest plan successfully', async () => {
      const deletePlanDto = { id: '507f1f77bcf86cd799439011' };

      mockHarvestPlanModel.findByIdAndDelete = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockHarvestPlan),
      });

      const result = await service.DeletePlan(deletePlanDto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Harvest plan deleted successfully');
      expect(mockHarvestPlanModel.findByIdAndDelete).toHaveBeenCalledWith(
        deletePlanDto.id
      );
    });

    it('should return error when deleting non-existent plan', async () => {
      const deletePlanDto = { id: 'nonexistent' };

      mockHarvestPlanModel.findByIdAndDelete = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.DeletePlan(deletePlanDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Harvest plan not found');
    });
  });
});
