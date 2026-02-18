import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan } from '../schemas/plan.schema';
import { Subscription } from '../schemas/subscription.schema';
import { User } from '../schemas/user.schema';
import {
  FEATURE_ENTITLEMENTS,
  FeatureEntitlement,
} from '../config/feature-entitlements.config';

const TRIAL_DURATION_DAYS = 14;

@Injectable()
export class SubscriptionService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  async seedPlans(): Promise<void> {
    const plans = [
      {
        key: 'free',
        name: 'Free Plan',
        level: 0,
        priceMonthlyLKR: 0,
        priceAnnualLKR: 0,
        featureKeys: ['weather_data', 'salinity'],
        duration: 'lifetime',
        isActive: true,
      },
      {
        key: 'pro',
        name: 'Pro Plan',
        level: 1,
        priceMonthlyLKR: 1500,
        priceAnnualLKR: 15000,
        featureKeys: [
          'weather_data',
          'salinity',
          'deals',
          'planner',
          'production_forecast',
          'demand_price_forecast',
          'distributor_recommendation',
          'waste_valorant',
        ],
        duration: 'monthly',
        isActive: true,
      },
      {
        key: 'lab',
        name: 'Lab Plan',
        level: 2,
        priceMonthlyLKR: 2500,
        priceAnnualLKR: 25000,
        featureKeys: [
          'quality_vision_control',
          'salt_crystal_impurity_checker',
          'realtime_statistics',
          'batch_identification',
        ],
        duration: 'monthly',
        isActive: true,
      },
    ];

    for (const planData of plans) {
      const exists = await this.planModel.findOne({ key: planData.key });
      if (!exists) {
        await this.planModel.create(planData);
        this.logger.log(`Seeded plan: ${planData.key}`);
      }
    }
  }

  async getPlans(): Promise<Plan[]> {
    return this.planModel.find({ isActive: true }).exec();
  }

  async getPlan(planKey: string): Promise<Plan | null> {
    return this.planModel.findOne({ key: planKey }).exec();
  }

  async createSubscription(
    userId: string,
    planKey: string,
    paymentMethod: string = 'free',
  ): Promise<Subscription> {
    const plan = await this.planModel.findOne({ key: planKey });
    if (!plan) {
      throw new Error(`Plan not found: ${planKey}`);
    }

    // Deactivate existing active subscriptions
    await this.subscriptionModel.updateMany(
      { userId: new Types.ObjectId(userId), status: { $in: ['active', 'trial'] } },
      { status: 'inactive' },
    );

    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      planId: plan._id,
      planKey,
      status: 'active',
      startDate: new Date(),
      endDate: null,
      isTrial: false,
      paymentMethod,
    });

    // Update user's plan
    await this.userModel.findByIdAndUpdate(userId, {
      plan: planKey,
      isSubscribed: true,
      isTrialActive: false,
    });

    return subscription;
  }

  async getActiveSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: { $in: ['active', 'trial'] },
      })
      .exec();
  }

  async startProTrial(userId: string): Promise<Subscription> {
    const plan = await this.planModel.findOne({ key: 'pro' });
    if (!plan) {
      throw new Error('Pro plan not found — run seedPlans first');
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      planId: plan._id,
      planKey: 'pro',
      status: 'trial',
      startDate: now,
      endDate: trialEnd,
      isTrial: true,
      paymentMethod: 'trial',
    });

    await this.userModel.findByIdAndUpdate(userId, {
      plan: 'pro',
      isTrialActive: true,
      trialStartDate: now,
      trialEndDate: trialEnd,
    });

    this.logger.log(`Started 14-day Pro trial for user ${userId}, expires ${trialEnd.toISOString()}`);
    return subscription;
  }

  async checkTrialExpiry(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.isTrialActive) return false;
    if (!user.trialEndDate) return false;
    return new Date() < new Date(user.trialEndDate);
  }

  async expireTrial(userId: string): Promise<void> {
    await this.subscriptionModel.updateMany(
      { userId: new Types.ObjectId(userId), status: 'trial' },
      { status: 'expired' },
    );

    await this.userModel.findByIdAndUpdate(userId, {
      plan: 'free',
      isTrialActive: false,
      isSubscribed: false,
    });

    this.logger.log(`Trial expired for user ${userId}, downgraded to free`);
  }

  async checkFeatureAccess(
    userId: string,
    featureKey: string,
    userRole: string,
  ): Promise<{ hasAccess: boolean; reason: string; requiredPlans: string[] }> {
    // ADMIN/SUPERADMIN bypass
    if (userRole === 'ADMIN' || userRole === 'SUPERADMIN') {
      return { hasAccess: true, reason: 'allowed', requiredPlans: [] };
    }

    const feature: FeatureEntitlement | undefined = FEATURE_ENTITLEMENTS.find(
      (f) => f.key === featureKey,
    );
    if (!feature) {
      // Unknown feature — allow by default (unprotected)
      return { hasAccess: true, reason: 'allowed', requiredPlans: [] };
    }

    // Check role
    if (!feature.allowedRoles.includes(userRole)) {
      return {
        hasAccess: false,
        reason: 'role_not_allowed',
        requiredPlans: feature.plans,
      };
    }

    // Check plan
    const user = await this.userModel.findById(userId);
    if (!user) {
      return { hasAccess: false, reason: 'plan_required', requiredPlans: feature.plans };
    }

    // If trial, check expiry
    if (user.isTrialActive) {
      const trialStillActive = await this.checkTrialExpiry(userId);
      if (!trialStillActive) {
        await this.expireTrial(userId);
        // Re-fetch user after downgrade
        const updatedUser = await this.userModel.findById(userId);
        if (!updatedUser || !feature.plans.includes(updatedUser.plan)) {
          return {
            hasAccess: false,
            reason: 'plan_required',
            requiredPlans: feature.plans,
          };
        }
      }
    }

    if (!feature.plans.includes(user.plan)) {
      return {
        hasAccess: false,
        reason: 'plan_required',
        requiredPlans: feature.plans,
      };
    }

    return { hasAccess: true, reason: 'allowed', requiredPlans: [] };
  }

  async processExpiredTrials(): Promise<number> {
    const expiredTrials = await this.subscriptionModel.find({
      status: 'trial',
      endDate: { $lt: new Date() },
    });

    let count = 0;
    for (const sub of expiredTrials) {
      await this.expireTrial(sub.userId.toString());
      count++;
    }

    if (count > 0) {
      this.logger.log(`Processed ${count} expired trial(s)`);
    }
    return count;
  }
}
