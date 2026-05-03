import { Module } from '@nestjs/common';
import { CloudSyncService } from './cloud-sync.service';
import { CloudSyncQueueService } from './cloud-sync-queue.service';
import { JwtValidatorService } from './jwt-validator.service';

@Module({
  providers: [CloudSyncService, CloudSyncQueueService, JwtValidatorService],
  exports: [CloudSyncService, CloudSyncQueueService, JwtValidatorService],
})
export class CloudSyncModule {}
