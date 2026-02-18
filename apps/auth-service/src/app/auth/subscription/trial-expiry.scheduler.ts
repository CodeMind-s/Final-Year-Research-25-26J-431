import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class TrialExpiryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialExpiryScheduler.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly subscriptionService: SubscriptionService) {}

  onModuleInit() {
    this.logger.log('Starting trial expiry scheduler (hourly)');
    this.intervalHandle = setInterval(async () => {
      try {
        const count = await this.subscriptionService.processExpiredTrials();
        if (count > 0) {
          this.logger.log(`Hourly check: expired ${count} trial(s)`);
        }
      } catch (error: any) {
        this.logger.error(`Trial expiry check failed: ${error.message}`);
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
