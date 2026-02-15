import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'vision',
        protoPath: join(__dirname, '../../../proto/vision.proto'),
        url: process.env.GRPC_URL || 'localhost:50057',
        maxReceiveMessageLength: 10 * 1024 * 1024,
        maxSendMessageLength: 10 * 1024 * 1024,
        loader: {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        },
      },
    },
  );

  await app.listen();
  Logger.log('Vision Service is running on gRPC port 50057');
}

bootstrap();
