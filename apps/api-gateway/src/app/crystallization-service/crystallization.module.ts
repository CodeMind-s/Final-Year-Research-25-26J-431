import { Module } from '@nestjs/common';
import {
  CrystallizationService,
} from './crystallization.service';
import { APP_FILTER } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { CrystallizationController } from './crystallization.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CRYSTALLIZATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'crystallization',
          protoPath: join(__dirname, 'proto/dailyMeasurements.proto'),
          url: process.env.CRYSTALLIZATION_SERVICE_URL || 'localhost:50054',
          loader: {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
          },
        },
      },
    ]),
  ],
  controllers: [CrystallizationController],
  providers: [
    CrystallizationService,
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
  ],
})
export class CrystallizationModule { }
