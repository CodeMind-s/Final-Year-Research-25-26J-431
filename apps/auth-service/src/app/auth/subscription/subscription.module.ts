import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Plan, PlanSchema } from '../schemas/plan.schema';
import { Subscription, SubscriptionSchema } from '../schemas/subscription.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { SubscriptionService } from './subscription.service';
import { TrialExpiryScheduler } from './trial-expiry.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [SubscriptionService, TrialExpiryScheduler],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
