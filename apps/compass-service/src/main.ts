import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: ['landowner', 'seller'],
      protoPath: [
        join(__dirname, '../../../proto/compass-landowner.proto'),
        join(__dirname, '../../../proto/compass-seller.proto'),
      ],
      url: process.env.GRPC_URL || 'localhost:50056',
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  await app.listen();
  Logger.log('🚀 Compass Service is running on gRPC port 50056');
}

bootstrap();
