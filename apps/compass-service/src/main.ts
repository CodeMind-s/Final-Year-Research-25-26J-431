import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: ['harvestplan'],
      protoPath: [join(__dirname, 'proto/harvestPlan.proto')],
      url: process.env.GRPC_URL || '0.0.0.0:50052',
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
  Logger.log('🚀 Compass Service (Harvest Plan) is running on gRPC port 50052');
}

bootstrap();
