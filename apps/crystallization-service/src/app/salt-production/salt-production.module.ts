import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { getKafkaClientConfig } from '@brinex-server/kafka-config';
import { SaltProductionController } from './salt-production.controller';
import { SaltProductionService } from './salt-production.service';
import {
  ActualMonthlyProduction,
  ActualMonthlyProductionSchema,
} from './schemas/actual-monthly-production.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ActualMonthlyProduction.name,
        schema: ActualMonthlyProductionSchema,
      },
    ]),
    ClientsModule.register([
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: getKafkaClientConfig('salt-production-service'),
          consumer: {
            groupId: 'salt-production-audit-consumer-group',
          },
        },
      },
    ]),
  ],
  controllers: [SaltProductionController],
  providers: [SaltProductionService],
  exports: [SaltProductionService],
})
export class SaltProductionModule {}
