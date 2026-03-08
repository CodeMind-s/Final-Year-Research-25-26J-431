/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'ai',
        protoPath: join(__dirname, 'proto/ai.proto'),
        url: process.env.GRPC_URL || '0.0.0.0:50059',
      },
    },
  );
  await app.listen();
  Logger.log(`🚀 AI microservice is listening on gRPC channel`);
}

bootstrap();
