import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan } from '../schemas/plan.schema';
import { Subscription } from '../schemas/subscription.schema';
import { User } from '../schemas/user.schema';

const TRIAL_DURATION_DAYS = 14;
const SUBSCRIPTION_DURATION_DAYS = 30;

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
    const plan = await this.planModel.findOne({ key: planKey, isActive: true });
    if (!plan) {
      throw new Error(`Plan not found or inactive: ${planKey}`);
    }

    // Deactivate existing active subscriptions
    await this.subscriptionModel.updateMany(
      { userId: new Types.ObjectId(userId), status: { $in: ['active', 'trial'] } },
      { status: 'inactive' },
    );

    const now = new Date();
    // Free plan has no expiry; paid plans expire after 30 days
    const endDate =
      planKey === 'free'
        ? null
        : new Date(now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const subscription = await this.subscriptionModel.create({
      userId: new Types.ObjectId(userId),
      planId: plan._id,
      planKey,
      status: 'active',
      startDate: now,
      endDate,
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

  async checkPlanAccess(
    userId: string,
    requiredPlanLevels: number[],
  ): Promise<{ allowed: boolean; reason: string; requiredPlanLevels: number[] }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return { allowed: false, reason: 'plan_required', requiredPlanLevels };
    }

    // If trial, check expiry
    if (user.isTrialActive) {
      const trialStillActive = await this.checkTrialExpiry(userId);
      if (!trialStillActive) {
        await this.expireTrial(userId);
        // Re-fetch user after downgrade
        const updatedUser = await this.userModel.findById(userId);
        const plan = updatedUser ? await this.getPlan(updatedUser.plan) : null;
        const level = plan?.level ?? 0;
        if (!requiredPlanLevels.includes(level)) {
          return { allowed: false, reason: 'trial_expired', requiredPlanLevels };
        }
        return { allowed: true, reason: 'allowed', requiredPlanLevels: [] };
      }
    }

    // Check if active paid subscription has expired
    const activeSub = await this.getActiveSubscription(userId);
    if (activeSub && activeSub.endDate && new Date() >= new Date(activeSub.endDate)) {
      await this.subscriptionModel.updateOne(
        { _id: activeSub._id },
        { status: 'expired' },
      );
      await this.userModel.findByIdAndUpdate(userId, {
        plan: 'free',
        isSubscribed: false,
      });
      this.logger.log(`Subscription expired on access check for user ${userId}`);
      const freePlan = await this.getPlan('free');
      const freeLevel = freePlan?.level ?? 0;
      if (!requiredPlanLevels.includes(freeLevel)) {
        return { allowed: false, reason: 'subscription_expired', requiredPlanLevels };
      }
      return { allowed: true, reason: 'allowed', requiredPlanLevels: [] };
    }

    // Check user's plan level against required levels
    const plan = await this.getPlan(user.plan);
    const level = plan?.level ?? 0;
    if (!requiredPlanLevels.includes(level)) {
      return { allowed: false, reason: 'plan_required', requiredPlanLevels };
    }

    return { allowed: true, reason: 'allowed', requiredPlanLevels: [] };
  }

  async createPlan(data: {
    key: string;
    name: string;
    level: number;
    priceMonthlyLKR: number;
    priceAnnualLKR: number;
    featureKeys: string[];
    duration: string;
  }): Promise<Plan> {
    const existing = await this.planModel.findOne({ key: data.key });
    if (existing) {
      throw new Error(`Plan with key '${data.key}' already exists`);
    }
    const plan = await this.planModel.create({ ...data, isActive: true });
    this.logger.log(`Created plan: ${data.key}`);
    return plan;
  }

  async updatePlan(
    key: string,
    updates: Partial<{
      name: string;
      level: number;
      priceMonthlyLKR: number;
      priceAnnualLKR: number;
      featureKeys: string[];
      duration: string;
      isActive: boolean;
    }>,
  ): Promise<Plan> {
    const plan = await this.planModel.findOneAndUpdate(
      { key },
      { $set: updates },
      { new: true },
    );
    if (!plan) {
      throw new Error(`Plan not found: ${key}`);
    }
    this.logger.log(`Updated plan: ${key}`);
    return plan;
  }

  async deletePlan(key: string): Promise<void> {
    if (key === 'free') {
      throw new Error('Cannot deactivate the free plan');
    }
    const plan = await this.planModel.findOneAndUpdate(
      { key },
      { isActive: false },
      { new: true },
    );
    if (!plan) {
      throw new Error(`Plan not found: ${key}`);
    }
    this.logger.log(`Deactivated plan: ${key}`);
  }

  async getAllSubscriptions(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [subscriptions, total] = await Promise.all([
      this.subscriptionModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.subscriptionModel.countDocuments(),
    ]);

    return { subscriptions, total, page, limit };
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

  async processExpiredSubscriptions(): Promise<number> {
    const expiredSubs = await this.subscriptionModel.find({
      status: 'active',
      endDate: { $ne: null, $lt: new Date() },
    });

    let count = 0;
    for (const sub of expiredSubs) {
      await this.subscriptionModel.updateOne(
        { _id: sub._id },
        { status: 'expired' },
      );

      await this.userModel.findByIdAndUpdate(sub.userId, {
        plan: 'free',
        isSubscribed: false,
      });

      this.logger.log(
        `Subscription expired for user ${sub.userId}, plan ${sub.planKey} — downgraded to free`,
      );
      count++;
    }

    if (count > 0) {
      this.logger.log(`Processed ${count} expired subscription(s)`);
    }
    return count;
  }
}
