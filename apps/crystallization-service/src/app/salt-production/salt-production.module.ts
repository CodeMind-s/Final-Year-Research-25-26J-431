import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
          client: {
            clientId: 'salt-production-service',
            brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
          },
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
