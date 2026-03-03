import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';

// Load .env.test if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });
} catch {
  // dotenv not required — env vars may already be set
}

import { Plan, PlanSchema } from '../../src/app/auth/schemas/plan.schema';
import { Subscription, SubscriptionSchema } from '../../src/app/auth/schemas/subscription.schema';
import { User, UserSchema } from '../../src/app/auth/schemas/user.schema';
import { SubscriptionService } from '../../src/app/auth/subscription/subscription.service';

const testMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/auth-test';

describe('Auth Service — Subscription E2E Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let planModel: Model<any>;
  let subscriptionModel: Model<any>;
  let userModel: Model<any>;
  let subscriptionService: SubscriptionService;

  const createdIds = {
    plans: [] as string[],
    subscriptions: [] as string[],
    users: [] as string[],
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(testMongoUri, {
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        }),
        MongooseModule.forFeature([
          { name: Plan.name, schema: PlanSchema },
          { name: Subscription.name, schema: SubscriptionSchema },
          { name: User.name, schema: UserSchema },
        ]),
      ],
      providers: [SubscriptionService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    planModel = moduleRef.get(getModelToken(Plan.name));
    subscriptionModel = moduleRef.get(getModelToken(Subscription.name));
    userModel = moduleRef.get(getModelToken(User.name));
    subscriptionService = moduleRef.get(SubscriptionService);
  }, 30000);

  afterAll(async () => {
    try {
      if (createdIds.subscriptions.length > 0) {
        await subscriptionModel.deleteMany({
          _id: { $in: createdIds.subscriptions.map((id) => new Types.ObjectId(id)) },
        });
      }
      if (createdIds.users.length > 0) {
        await userModel.deleteMany({
          _id: { $in: createdIds.users.map((id) => new Types.ObjectId(id)) },
        });
      }
      if (createdIds.plans.length > 0) {
        await planModel.deleteMany({
          _id: { $in: createdIds.plans.map((id) => new Types.ObjectId(id)) },
        });
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }

    if (app) {
      await app.close();
    }
  }, 15000);

  /** Helper: create a test user tracked for cleanup */
  async function createTestUser(overrides: Partial<any> = {}): Promise<any> {
    const user = await userModel.create({
      role: 'LANDOWNER',
      plan: 'free',
      isOnboarded: true,
      ...overrides,
    });
    createdIds.users.push(user._id.toString());
    return user;
  }

  // ──────────────── Plan CRUD ────────────────

  describe('Plan CRUD', () => {
    beforeAll(async () => {
      // Clean up any leftover test plans from previous runs
      await planModel.deleteMany({ key: 'e2e-test-plan' });
    });

    it('should return seeded plans (free, pro, lab)', async () => {
      const plans = await subscriptionService.getPlans();

      expect(plans.length).toBeGreaterThanOrEqual(3);
      const keys = plans.map((p) => p.key);
      expect(keys).toContain('free');
      expect(keys).toContain('pro');
      expect(keys).toContain('lab');
    });

    it('should get a single plan by key', async () => {
      const plan = await subscriptionService.getPlan('pro');

      expect(plan).toBeDefined();
      expect(plan.key).toBe('pro');
      expect(plan.level).toBe(1);
      expect(plan.priceMonthlyLKR).toBe(1500);
    });

    it('should create a new plan', async () => {
      const plan = await subscriptionService.createPlan({
        key: 'e2e-test-plan',
        name: 'E2E Test Plan',
        level: 99,
        priceMonthlyLKR: 999,
        priceAnnualLKR: 9999,
        featureKeys: ['feature_a', 'feature_b'],
        duration: 'monthly',
      });

      createdIds.plans.push(plan._id.toString());

      expect(plan.key).toBe('e2e-test-plan');
      expect(plan.level).toBe(99);
      expect(plan.isActive).toBe(true);
    });

    it('should reject duplicate plan key', async () => {
      await expect(
        subscriptionService.createPlan({
          key: 'e2e-test-plan',
          name: 'Duplicate',
          level: 100,
          priceMonthlyLKR: 0,
          priceAnnualLKR: 0,
          featureKeys: [],
          duration: 'monthly',
        }),
      ).rejects.toThrow("Plan with key 'e2e-test-plan' already exists");
    });

    it('should update a plan', async () => {
      const updated = await subscriptionService.updatePlan('e2e-test-plan', {
        priceMonthlyLKR: 1999,
        name: 'Updated E2E Plan',
      });

      expect(updated.priceMonthlyLKR).toBe(1999);
      expect(updated.name).toBe('Updated E2E Plan');
    });

    it('should deactivate a plan (deletePlan)', async () => {
      await subscriptionService.deletePlan('e2e-test-plan');

      const plan = await planModel.findOne({ key: 'e2e-test-plan' });
      expect(plan.isActive).toBe(false);
    });

    it('should prevent deleting the free plan', async () => {
      await expect(
        subscriptionService.deletePlan('free'),
      ).rejects.toThrow('Cannot deactivate the free plan');
    });
  });

  // ──────────────── Subscription Lifecycle ────────────────

  describe('Subscription Lifecycle', () => {
    it('should create a subscription and update user plan', async () => {
      const user = await createTestUser();

      const subscription = await subscriptionService.createSubscription(
        user._id.toString(),
        'pro',
        'payhere',
      );

      createdIds.subscriptions.push(subscription._id.toString());

      expect(subscription.planKey).toBe('pro');
      expect(subscription.status).toBe('active');
      expect(subscription.isTrial).toBe(false);
      expect(subscription.endDate).toBeDefined(); // paid plans have endDate

      // Verify user was updated
      const updatedUser = await userModel.findById(user._id);
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.isSubscribed).toBe(true);
    });

    it('should deactivate old subscription when creating new one', async () => {
      const user = await createTestUser();

      const sub1 = await subscriptionService.createSubscription(
        user._id.toString(), 'pro', 'payhere',
      );
      createdIds.subscriptions.push(sub1._id.toString());

      const sub2 = await subscriptionService.createSubscription(
        user._id.toString(), 'lab', 'payhere',
      );
      createdIds.subscriptions.push(sub2._id.toString());

      // Old subscription should be inactive
      const oldSub = await subscriptionModel.findById(sub1._id);
      expect(oldSub.status).toBe('inactive');

      // New subscription should be active
      expect(sub2.status).toBe('active');
      expect(sub2.planKey).toBe('lab');
    });

    it('should get active subscription for user', async () => {
      const user = await createTestUser();

      const sub = await subscriptionService.createSubscription(
        user._id.toString(), 'pro', 'payhere',
      );
      createdIds.subscriptions.push(sub._id.toString());

      const active = await subscriptionService.getActiveSubscription(user._id.toString());

      expect(active).toBeDefined();
      expect(active._id.toString()).toBe(sub._id.toString());
    });

    it('should create free subscription with no endDate', async () => {
      const user = await createTestUser();

      const sub = await subscriptionService.createSubscription(
        user._id.toString(), 'free', 'free',
      );
      createdIds.subscriptions.push(sub._id.toString());

      expect(sub.endDate).toBeNull();
      expect(sub.planKey).toBe('free');
    });
  });

  // ──────────────── Trial ────────────────

  describe('Trial', () => {
    it('should start a pro trial', async () => {
      const user = await createTestUser();

      const trial = await subscriptionService.startProTrial(user._id.toString());
      createdIds.subscriptions.push(trial._id.toString());

      expect(trial.status).toBe('trial');
      expect(trial.isTrial).toBe(true);
      expect(trial.planKey).toBe('pro');
      expect(trial.endDate).toBeDefined();

      // Verify user updated
      const updatedUser = await userModel.findById(user._id);
      expect(updatedUser.plan).toBe('pro');
      expect(updatedUser.isTrialActive).toBe(true);
      expect(updatedUser.trialStartDate).toBeDefined();
      expect(updatedUser.trialEndDate).toBeDefined();
    });

    it('should check trial is active', async () => {
      const user = await createTestUser();

      const trial = await subscriptionService.startProTrial(user._id.toString());
      createdIds.subscriptions.push(trial._id.toString());

      const isActive = await subscriptionService.checkTrialExpiry(user._id.toString());
      expect(isActive).toBe(true);
    });

    it('should expire a trial and downgrade to free', async () => {
      const user = await createTestUser();

      const trial = await subscriptionService.startProTrial(user._id.toString());
      createdIds.subscriptions.push(trial._id.toString());

      await subscriptionService.expireTrial(user._id.toString());

      const updatedUser = await userModel.findById(user._id);
      expect(updatedUser.plan).toBe('free');
      expect(updatedUser.isTrialActive).toBe(false);
      expect(updatedUser.isSubscribed).toBe(false);

      const expiredSub = await subscriptionModel.findById(trial._id);
      expect(expiredSub.status).toBe('expired');
    });
  });

  // ──────────────── checkPlanAccess ────────────────

  describe('checkPlanAccess', () => {
    it('should allow access when user has required plan level', async () => {
      const user = await createTestUser();

      const sub = await subscriptionService.createSubscription(
        user._id.toString(), 'pro', 'payhere',
      );
      createdIds.subscriptions.push(sub._id.toString());

      const result = await subscriptionService.checkPlanAccess(
        user._id.toString(), [1],
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('allowed');
    });

    it('should deny access when user plan level is insufficient', async () => {
      const user = await createTestUser(); // free plan (level 0)

      const result = await subscriptionService.checkPlanAccess(
        user._id.toString(), [1, 2],
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('plan_required');
    });

    it('should handle expired trial during access check', async () => {
      const user = await createTestUser();

      const trial = await subscriptionService.startProTrial(user._id.toString());
      createdIds.subscriptions.push(trial._id.toString());

      // Manually set trial end date to past
      await userModel.findByIdAndUpdate(user._id, {
        trialEndDate: new Date(Date.now() - 1000),
      });

      const result = await subscriptionService.checkPlanAccess(
        user._id.toString(), [1],
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('trial_expired');
    });
  });

  // ──────────────── processExpiredTrials ────────────────

  describe('processExpiredTrials', () => {
    it('should expire trials past their end date', async () => {
      const user = await createTestUser();
      const proPlan = await planModel.findOne({ key: 'pro' });

      // Create a trial subscription with past endDate
      const trial = await subscriptionModel.create({
        userId: new Types.ObjectId(user._id),
        planId: proPlan._id,
        planKey: 'pro',
        status: 'trial',
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired yesterday
        isTrial: true,
        paymentMethod: 'trial',
      });
      createdIds.subscriptions.push(trial._id.toString());

      await userModel.findByIdAndUpdate(user._id, {
        plan: 'pro',
        isTrialActive: true,
        trialEndDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      });

      const count = await subscriptionService.processExpiredTrials();
      expect(count).toBeGreaterThanOrEqual(1);

      const updatedUser = await userModel.findById(user._id);
      expect(updatedUser.plan).toBe('free');
      expect(updatedUser.isTrialActive).toBe(false);
    });
  });

  // ──────────────── processExpiredSubscriptions ────────────────

  describe('processExpiredSubscriptions', () => {
    it('should deactivate subscriptions past their end date', async () => {
      const user = await createTestUser();
      const proPlan = await planModel.findOne({ key: 'pro' });

      const sub = await subscriptionModel.create({
        userId: new Types.ObjectId(user._id),
        planId: proPlan._id,
        planKey: 'pro',
        status: 'active',
        startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // expired yesterday
        isTrial: false,
        paymentMethod: 'payhere',
      });
      createdIds.subscriptions.push(sub._id.toString());

      await userModel.findByIdAndUpdate(user._id, {
        plan: 'pro',
        isSubscribed: true,
      });

      const count = await subscriptionService.processExpiredSubscriptions();
      expect(count).toBeGreaterThanOrEqual(1);

      const updatedUser = await userModel.findById(user._id);
      expect(updatedUser.plan).toBe('free');
      expect(updatedUser.isSubscribed).toBe(false);

      const expiredSub = await subscriptionModel.findById(sub._id);
      expect(expiredSub.status).toBe('expired');
    });
  });

  // ──────────────── getAllSubscriptions ────────────────

  describe('getAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const result = await subscriptionService.getAllSubscriptions(1, 10);

      expect(result.subscriptions).toBeDefined();
      expect(Array.isArray(result.subscriptions)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
