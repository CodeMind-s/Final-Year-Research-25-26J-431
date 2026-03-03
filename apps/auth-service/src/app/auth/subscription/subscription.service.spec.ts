import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { Types } from 'mongoose';

describe('SubscriptionService', () => {
  let service: any; // Use any to avoid stale .d.ts type issues
  let planModel: any;
  let subscriptionModel: any;
  let userModel: any;

  const mockUserId = '507f1f77bcf86cd799439011';
  const mockPlanId = '507f1f77bcf86cd799439020';

  const mockFreePlan = {
    _id: mockPlanId,
    key: 'free',
    name: 'Free Plan',
    level: 0,
    priceMonthlyLKR: 0,
    priceAnnualLKR: 0,
    featureKeys: ['weather_data', 'salinity'],
    duration: 'lifetime',
    isActive: true,
  };

  const mockProPlan = {
    _id: '507f1f77bcf86cd799439021',
    key: 'pro',
    name: 'Pro Plan',
    level: 1,
    priceMonthlyLKR: 1500,
    priceAnnualLKR: 15000,
    featureKeys: ['weather_data', 'salinity', 'deals', 'planner'],
    duration: 'monthly',
    isActive: true,
  };

  const mockLabPlan = {
    _id: '507f1f77bcf86cd799439022',
    key: 'lab',
    name: 'Lab Plan',
    level: 2,
    priceMonthlyLKR: 2500,
    priceAnnualLKR: 25000,
    featureKeys: ['quality_vision_control', 'salt_crystal_impurity_checker'],
    duration: 'monthly',
    isActive: true,
  };

  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    role: 'LANDOWNER',
    plan: 'pro',
    isTrialActive: true,
    trialStartDate: new Date('2025-01-01'),
    trialEndDate: new Date('2025-01-15'),
    isSubscribed: false,
  };

  const mockSubscription = {
    _id: 'sub1',
    userId: new Types.ObjectId(mockUserId),
    planId: mockProPlan._id,
    planKey: 'pro',
    status: 'active',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-31'),
    isTrial: false,
    paymentMethod: 'payhere',
  };

  const mockTrialSubscription = {
    _id: 'sub2',
    userId: new Types.ObjectId(mockUserId),
    planId: mockProPlan._id,
    planKey: 'pro',
    status: 'trial',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-15'),
    isTrial: true,
    paymentMethod: 'trial',
  };

  const createMockQuery = (data: any) => {
    const query: any = {
      exec: jest.fn().mockResolvedValue(data),
      select: jest.fn(),
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(),
      populate: jest.fn(),
      then: function (resolve: any, reject: any) {
        return Promise.resolve(data).then(resolve, reject);
      },
    };
    query.select.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    query.populate.mockReturnValue(query);
    return query;
  };

  const createMockModel = (mockData: any = null) => {
    const mockModelInstance = {
      save: jest.fn().mockResolvedValue(mockData),
    };

    const model = jest.fn().mockImplementation(() => mockModelInstance);

    Object.assign(model, {
      findOne: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findById: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findByIdAndUpdate: jest.fn().mockReturnValue(createMockQuery(mockData)),
      findOneAndUpdate: jest.fn().mockReturnValue(createMockQuery(mockData)),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([mockData]),
            }),
          }),
        }),
        exec: jest.fn().mockResolvedValue([mockData]),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(mockData),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    });

    return model;
  };

  beforeEach(async () => {
    planModel = createMockModel(mockProPlan);
    subscriptionModel = createMockModel(mockSubscription);
    userModel = createMockModel(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getModelToken('Plan'), useValue: planModel },
        { provide: getModelToken('Subscription'), useValue: subscriptionModel },
        { provide: getModelToken('User'), useValue: userModel },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────
  // getPlans
  // ──────────────────────────────────────────────────────────────────
  describe('getPlans', () => {
    it('should return active plans', async () => {
      planModel.find.mockReturnValue(createMockQuery([mockFreePlan, mockProPlan, mockLabPlan]));

      const result = await service.getPlans();

      expect(result).toHaveLength(3);
      expect(planModel.find).toHaveBeenCalledWith({ isActive: true });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getPlan
  // ──────────────────────────────────────────────────────────────────
  describe('getPlan', () => {
    it('should return plan by key', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const result = await service.getPlan('pro');

      expect(result).toEqual(mockProPlan);
      expect(planModel.findOne).toHaveBeenCalledWith({ key: 'pro' });
    });

    it('should return null if plan not found', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(null));

      const result = await service.getPlan('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // createSubscription
  // ──────────────────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('should deactivate old subscriptions and create a new one', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const createdSub = {
        ...mockSubscription,
        status: 'active',
        isTrial: false,
        paymentMethod: 'payhere',
      };
      subscriptionModel.create.mockResolvedValue(createdSub);

      const result = await service.createSubscription(mockUserId, 'pro', 'payhere');

      expect(result).toEqual(createdSub);
      expect(subscriptionModel.updateMany).toHaveBeenCalledWith(
        { userId: expect.any(Types.ObjectId), status: { $in: ['active', 'trial'] } },
        { status: 'inactive' },
      );
      expect(subscriptionModel.create).toHaveBeenCalledWith(expect.objectContaining({
        planKey: 'pro',
        status: 'active',
        isTrial: false,
        paymentMethod: 'payhere',
      }));
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUserId, {
        plan: 'pro',
        isSubscribed: true,
        isTrialActive: false,
      });
    });

    it('should throw error when plan is not found or inactive', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(null));

      await expect(service.createSubscription(mockUserId, 'nonexistent', 'payhere'))
        .rejects.toThrow('Plan not found or inactive: nonexistent');
    });

    it('should set endDate to null for free plan', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockFreePlan));
      subscriptionModel.create.mockResolvedValue({ ...mockSubscription, planKey: 'free', endDate: null });

      await service.createSubscription(mockUserId, 'free', 'free');

      expect(subscriptionModel.create).toHaveBeenCalledWith(expect.objectContaining({
        planKey: 'free',
        endDate: null,
      }));
    });

    it('should set endDate to 30 days from now for paid plans', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));
      subscriptionModel.create.mockResolvedValue(mockSubscription);

      await service.createSubscription(mockUserId, 'pro', 'payhere');

      const createCall = subscriptionModel.create.mock.calls[0][0];
      expect(createCall.endDate).toBeInstanceOf(Date);
      // Verify endDate is approximately 30 days from now
      const diffMs = createCall.endDate.getTime() - createCall.startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // startProTrial
  // ──────────────────────────────────────────────────────────────────
  describe('startProTrial', () => {
    it('should create a trial subscription and update user', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const trialSub = {
        ...mockTrialSubscription,
        status: 'trial',
        isTrial: true,
        paymentMethod: 'trial',
      };
      subscriptionModel.create.mockResolvedValue(trialSub);

      const result = await service.startProTrial(mockUserId);

      expect(result).toEqual(trialSub);
      expect(planModel.findOne).toHaveBeenCalledWith({ key: 'pro' });
      expect(subscriptionModel.create).toHaveBeenCalledWith(expect.objectContaining({
        planKey: 'pro',
        status: 'trial',
        isTrial: true,
        paymentMethod: 'trial',
      }));
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUserId, expect.objectContaining({
        plan: 'pro',
        isTrialActive: true,
      }));
    });

    it('should set trial end date to 14 days from now', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));
      subscriptionModel.create.mockResolvedValue(mockTrialSubscription);

      await service.startProTrial(mockUserId);

      const createCall = subscriptionModel.create.mock.calls[0][0];
      const diffMs = createCall.endDate.getTime() - createCall.startDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(14, 0);
    });

    it('should throw error if Pro plan not found', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(null));

      await expect(service.startProTrial(mockUserId))
        .rejects.toThrow('Pro plan not found — run seedPlans first');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // checkPlanAccess
  // ──────────────────────────────────────────────────────────────────
  describe('checkPlanAccess', () => {
    it('should return allowed when user plan level is in required levels', async () => {
      userModel.findById.mockReturnValue(createMockQuery({ ...mockUser, isTrialActive: false, plan: 'pro' }));
      // No active subscription with end date
      subscriptionModel.findOne.mockReturnValue(createMockQuery(null));
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const result = await service.checkPlanAccess(mockUserId, [0, 1]);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('allowed');
    });

    it('should return denied when user plan level is not in required levels', async () => {
      const freeUser = { ...mockUser, isTrialActive: false, plan: 'free' };
      userModel.findById.mockReturnValue(createMockQuery(freeUser));
      subscriptionModel.findOne.mockReturnValue(createMockQuery(null));
      planModel.findOne.mockReturnValue(createMockQuery(mockFreePlan));

      const result = await service.checkPlanAccess(mockUserId, [1, 2]);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('plan_required');
      expect(result.requiredPlanLevels).toEqual([1, 2]);
    });

    it('should detect trial expiry and downgrade user', async () => {
      // User has active trial, but trial has expired
      const trialExpiredUser = {
        ...mockUser,
        isTrialActive: true,
        trialEndDate: new Date('2024-01-01'), // Past date
        plan: 'pro',
      };
      userModel.findById
        .mockReturnValueOnce(createMockQuery(trialExpiredUser))  // first call in checkPlanAccess
        .mockReturnValueOnce(createMockQuery(trialExpiredUser))  // checkTrialExpiry
        .mockReturnValueOnce(createMockQuery({ ...trialExpiredUser, plan: 'free', isTrialActive: false })); // after expireTrial refetch

      planModel.findOne.mockReturnValue(createMockQuery(mockFreePlan));

      const result = await service.checkPlanAccess(mockUserId, [1, 2]);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_expired');
    });

    it('should detect subscription expiry and downgrade user', async () => {
      const nonTrialUser = { ...mockUser, isTrialActive: false, plan: 'pro' };
      userModel.findById.mockReturnValue(createMockQuery(nonTrialUser));

      // Active subscription with expired end date
      const expiredSub = {
        _id: 'sub-expired',
        userId: new Types.ObjectId(mockUserId),
        planKey: 'pro',
        status: 'active',
        endDate: new Date('2024-01-01'), // Past date
      };
      subscriptionModel.findOne.mockReturnValue(createMockQuery(expiredSub));

      planModel.findOne.mockReturnValue(createMockQuery(mockFreePlan));

      const result = await service.checkPlanAccess(mockUserId, [1, 2]);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('subscription_expired');
      expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: 'sub-expired' },
        { status: 'expired' },
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUserId, {
        plan: 'free',
        isSubscribed: false,
      });
    });

    it('should return plan_required when user not found', async () => {
      userModel.findById.mockReturnValue(createMockQuery(null));

      const result = await service.checkPlanAccess('invalidId', [1]);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('plan_required');
    });

    it('should allow access when trial is still active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days in the future

      const activeTrialUser = {
        ...mockUser,
        isTrialActive: true,
        trialEndDate: futureDate,
        plan: 'pro',
      };
      userModel.findById.mockReturnValue(createMockQuery(activeTrialUser));

      // getActiveSubscription returns active trial sub
      subscriptionModel.findOne.mockReturnValue(createMockQuery(null));

      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const result = await service.checkPlanAccess(mockUserId, [0, 1]);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('allowed');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // createPlan
  // ──────────────────────────────────────────────────────────────────
  describe('createPlan', () => {
    it('should create a new plan', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(null)); // no existing plan

      const newPlan = {
        key: 'enterprise',
        name: 'Enterprise Plan',
        level: 3,
        priceMonthlyLKR: 5000,
        priceAnnualLKR: 50000,
        featureKeys: ['all_features'],
        duration: 'monthly',
      };

      const createdPlan = { ...newPlan, isActive: true, _id: 'newPlanId' };
      planModel.create.mockResolvedValue(createdPlan);

      const result = await service.createPlan(newPlan);

      expect(result).toEqual(createdPlan);
      expect(planModel.create).toHaveBeenCalledWith(expect.objectContaining({
        ...newPlan,
        isActive: true,
      }));
    });

    it('should throw error if plan key already exists', async () => {
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      const duplicatePlan = {
        key: 'pro',
        name: 'Pro Plan Duplicate',
        level: 1,
        priceMonthlyLKR: 1500,
        priceAnnualLKR: 15000,
        featureKeys: [],
        duration: 'monthly',
      };

      await expect(service.createPlan(duplicatePlan))
        .rejects.toThrow("Plan with key 'pro' already exists");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // updatePlan
  // ──────────────────────────────────────────────────────────────────
  describe('updatePlan', () => {
    it('should update plan successfully', async () => {
      const updatedPlan = { ...mockProPlan, name: 'Pro Plus' };
      planModel.findOneAndUpdate.mockReturnValue(createMockQuery(updatedPlan));

      const result = await service.updatePlan('pro', { name: 'Pro Plus' });

      expect(result).toEqual(updatedPlan);
      expect(planModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'pro' },
        { $set: { name: 'Pro Plus' } },
        { new: true },
      );
    });

    it('should throw error if plan not found', async () => {
      planModel.findOneAndUpdate.mockReturnValue(createMockQuery(null));

      await expect(service.updatePlan('nonexistent', { name: 'Test' }))
        .rejects.toThrow('Plan not found: nonexistent');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // deletePlan
  // ──────────────────────────────────────────────────────────────────
  describe('deletePlan', () => {
    it('should deactivate plan', async () => {
      planModel.findOneAndUpdate.mockReturnValue(createMockQuery({ ...mockProPlan, isActive: false }));

      await service.deletePlan('pro');

      expect(planModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'pro' },
        { isActive: false },
        { new: true },
      );
    });

    it('should throw error when trying to delete free plan', async () => {
      await expect(service.deletePlan('free'))
        .rejects.toThrow('Cannot deactivate the free plan');
    });

    it('should throw error if plan not found', async () => {
      planModel.findOneAndUpdate.mockReturnValue(createMockQuery(null));

      await expect(service.deletePlan('nonexistent'))
        .rejects.toThrow('Plan not found: nonexistent');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getAllSubscriptions
  // ──────────────────────────────────────────────────────────────────
  describe('getAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const mockSubs = [mockSubscription];
      subscriptionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockSubs),
            }),
          }),
        }),
      });
      subscriptionModel.countDocuments.mockResolvedValue(1);

      const result = await service.getAllSubscriptions(1, 10);

      expect(result.subscriptions).toEqual(mockSubs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should apply correct skip for page 2', async () => {
      const mockSubs = [mockSubscription];
      const mockSkip = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockSubs),
        }),
      });
      const mockSort = jest.fn().mockReturnValue({
        skip: mockSkip,
      });
      subscriptionModel.find.mockReturnValue({
        sort: mockSort,
      });
      subscriptionModel.countDocuments.mockResolvedValue(15);

      const result = await service.getAllSubscriptions(2, 10);

      expect(mockSkip).toHaveBeenCalledWith(10); // (2-1) * 10 = 10
      expect(result.page).toBe(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // processExpiredTrials
  // ──────────────────────────────────────────────────────────────────
  describe('processExpiredTrials', () => {
    it('should process expired trials and return count', async () => {
      const expiredTrials = [
        { userId: new Types.ObjectId(mockUserId), status: 'trial' },
        { userId: new Types.ObjectId('507f1f77bcf86cd799439099'), status: 'trial' },
      ];
      subscriptionModel.find.mockResolvedValue(expiredTrials);

      const count = await service.processExpiredTrials();

      expect(count).toBe(2);
      // expireTrial should be called for each expired trial
      expect(subscriptionModel.updateMany).toHaveBeenCalledTimes(2);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no expired trials found', async () => {
      subscriptionModel.find.mockResolvedValue([]);

      const count = await service.processExpiredTrials();

      expect(count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // processExpiredSubscriptions
  // ──────────────────────────────────────────────────────────────────
  describe('processExpiredSubscriptions', () => {
    it('should process expired subscriptions and return count', async () => {
      const expiredSubs = [
        { _id: 'sub1', userId: new Types.ObjectId(mockUserId), planKey: 'pro', status: 'active' },
        { _id: 'sub2', userId: new Types.ObjectId('507f1f77bcf86cd799439099'), planKey: 'lab', status: 'active' },
      ];
      subscriptionModel.find.mockResolvedValue(expiredSubs);

      const count = await service.processExpiredSubscriptions();

      expect(count).toBe(2);
      expect(subscriptionModel.updateOne).toHaveBeenCalledTimes(2);
      expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: 'sub1' },
        { status: 'expired' },
      );
      expect(subscriptionModel.updateOne).toHaveBeenCalledWith(
        { _id: 'sub2' },
        { status: 'expired' },
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no expired subscriptions found', async () => {
      subscriptionModel.find.mockResolvedValue([]);

      const count = await service.processExpiredSubscriptions();

      expect(count).toBe(0);
    });

    it('should downgrade each expired user to free plan', async () => {
      const expiredSubs = [
        { _id: 'sub1', userId: new Types.ObjectId(mockUserId), planKey: 'pro', status: 'active' },
      ];
      subscriptionModel.find.mockResolvedValue(expiredSubs);

      await service.processExpiredSubscriptions();

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { plan: 'free', isSubscribed: false },
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // seedPlans (called via onModuleInit)
  // ──────────────────────────────────────────────────────────────────
  describe('seedPlans', () => {
    it('should seed plans that do not exist', async () => {
      // All plans not found (new DB)
      planModel.findOne.mockReturnValue(createMockQuery(null));
      planModel.create.mockResolvedValue({});

      await service.seedPlans();

      // Should create 3 plans: free, pro, lab
      expect(planModel.create).toHaveBeenCalledTimes(3);
      expect(planModel.create).toHaveBeenCalledWith(expect.objectContaining({ key: 'free' }));
      expect(planModel.create).toHaveBeenCalledWith(expect.objectContaining({ key: 'pro' }));
      expect(planModel.create).toHaveBeenCalledWith(expect.objectContaining({ key: 'lab' }));
    });

    it('should not create plans that already exist', async () => {
      // All plans already exist
      planModel.findOne.mockReturnValue(createMockQuery(mockProPlan));

      await service.seedPlans();

      expect(planModel.create).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getActiveSubscription
  // ──────────────────────────────────────────────────────────────────
  describe('getActiveSubscription', () => {
    it('should return active subscription for user', async () => {
      subscriptionModel.findOne.mockReturnValue(createMockQuery(mockSubscription));

      const result = await service.getActiveSubscription(mockUserId);

      expect(result).toEqual(mockSubscription);
      expect(subscriptionModel.findOne).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        status: { $in: ['active', 'trial'] },
      });
    });

    it('should return null when no active subscription exists', async () => {
      subscriptionModel.findOne.mockReturnValue(createMockQuery(null));

      const result = await service.getActiveSubscription(mockUserId);

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // checkTrialExpiry
  // ──────────────────────────────────────────────────────────────────
  describe('checkTrialExpiry', () => {
    it('should return true when trial is still active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const activeTrialUser = { ...mockUser, isTrialActive: true, trialEndDate: futureDate };
      userModel.findById.mockReturnValue(createMockQuery(activeTrialUser));

      const result = await service.checkTrialExpiry(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false when trial has expired', async () => {
      const pastDate = new Date('2024-01-01');
      const expiredTrialUser = { ...mockUser, isTrialActive: true, trialEndDate: pastDate };
      userModel.findById.mockReturnValue(createMockQuery(expiredTrialUser));

      const result = await service.checkTrialExpiry(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      userModel.findById.mockReturnValue(createMockQuery(null));

      const result = await service.checkTrialExpiry('invalidId');

      expect(result).toBe(false);
    });

    it('should return false when trial is not active', async () => {
      const noTrialUser = { ...mockUser, isTrialActive: false };
      userModel.findById.mockReturnValue(createMockQuery(noTrialUser));

      const result = await service.checkTrialExpiry(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false when trialEndDate is null', async () => {
      const nullTrialDate = { ...mockUser, isTrialActive: true, trialEndDate: null };
      userModel.findById.mockReturnValue(createMockQuery(nullTrialDate));

      const result = await service.checkTrialExpiry(mockUserId);

      expect(result).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // expireTrial
  // ──────────────────────────────────────────────────────────────────
  describe('expireTrial', () => {
    it('should mark trial subscriptions as expired and downgrade user to free', async () => {
      await service.expireTrial(mockUserId);

      expect(subscriptionModel.updateMany).toHaveBeenCalledWith(
        { userId: expect.any(Types.ObjectId), status: 'trial' },
        { status: 'expired' },
      );
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(mockUserId, {
        plan: 'free',
        isTrialActive: false,
        isSubscribed: false,
      });
    });
  });
});
