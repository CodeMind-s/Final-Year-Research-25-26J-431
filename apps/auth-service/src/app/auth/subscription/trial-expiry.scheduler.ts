import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class TrialExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialExpiryScheduler.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly subscriptionService: SubscriptionService) {}

  onModuleInit() {
    this.logger.log('Starting subscription expiry scheduler (hourly)');
    this.intervalHandle = setInterval(async () => {
      try {
        const trialCount = await this.subscriptionService.processExpiredTrials();
        if (trialCount > 0) {
          this.logger.log(`Hourly check: expired ${trialCount} trial(s)`);
        }

        const subCount = await this.subscriptionService.processExpiredSubscriptions();
        if (subCount > 0) {
          this.logger.log(`Hourly check: expired ${subCount} subscription(s)`);
        }
      } catch (error: any) {
        this.logger.error(`Subscription expiry check failed: ${error.message}`);
      }
    }, EXPIRY_CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('Trial expiry scheduler stopped');
    }
  }
}
