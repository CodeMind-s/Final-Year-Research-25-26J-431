/**
 * This is the main entry point for the email service.
 * It bootstraps a Kafka microservice to handle email sending operations.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { getKafkaClientConfig } from '@brinex-server/kafka-config';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: getKafkaClientConfig('email-service'),
        consumer: {
          groupId: 'email-consumer-group',
        },
      },
    },
  );
  await app.listen();
  Logger.log(`🚀 Email microservice is listening on Kafka broker: ${process.env.KAFKA_BROKER || 'localhost:29092'}`);
}

bootstrap();
