import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { getKafkaClientConfig } from '@brinex-server/kafka-config';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: getKafkaClientConfig('api-gateway-audit-log'),
          consumer: {
            groupId: 'api-gateway-audit-log-consumer-group',
          },
        },
      },
    ]),
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
