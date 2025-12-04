/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'logs',
      protoPath: join(__dirname, '../../../proto/logs.proto'),
      url: process.env.GRPC_URL || 'localhost:50056',
    },
  });

  await app.listen();
  Logger.log('🚀 Logs Service is running on gRPC port 50056');
}

bootstrap();
