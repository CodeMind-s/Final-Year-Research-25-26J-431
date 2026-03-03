import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: ['wasteval'],
      protoPath: [join(__dirname, 'proto/wasteValorization.proto')],
      url: process.env.GRPC_URL || '0.0.0.0:50058',
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
  Logger.log('🚀 Waste Valorization Service is running on gRPC port 50058');
}

bootstrap();
