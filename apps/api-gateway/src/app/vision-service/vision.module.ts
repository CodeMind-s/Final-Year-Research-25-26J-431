import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { APP_FILTER } from '@nestjs/core';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { VisionController } from './vision.controller';
import { VisionGateway } from './vision.gateway';
import { getGrpcCredentials } from '../../grpc-credentials';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'VISION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'vision',
          protoPath: join(__dirname, 'proto/vision.proto'),
          url: process.env.VISION_SERVICE_URL || 'localhost:50057',
          credentials: getGrpcCredentials(),
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
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, 'proto/auth.proto'),
          url: process.env.AUTH_SERVICE_URL || 'localhost:50000',
          credentials: getGrpcCredentials(),
        },
      },
    ]),
  ],
  controllers: [VisionController],
  providers: [
    VisionGateway,
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
  ],
})
export class VisionModule {}
