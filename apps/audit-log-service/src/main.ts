/**
 * Audit Log Service - Kafka Microservice
 * Handles audit logging for all API requests across the system
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { getKafkaClientConfig } from '@brinex-server/kafka-config';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: getKafkaClientConfig('audit-log-service'),
        consumer: {
          groupId: 'audit-log-consumer-group',
        },
      },
    },
  );

  await app.listen();
  Logger.log(`🚀 Audit Log Service is listening on Kafka broker: ${process.env.KAFKA_BROKER || 'localhost:29092'}`);
}

bootstrap();
