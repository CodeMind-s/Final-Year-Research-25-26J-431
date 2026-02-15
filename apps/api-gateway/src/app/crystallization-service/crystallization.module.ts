import { Module } from '@nestjs/common';
import {
  CrystallizationService,
} from './crystallization.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { CrystallizationController } from './crystallization.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      global: true,
    }),
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
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, 'proto/auth.proto'),
          url: process.env.AUTH_SERVICE_URL || 'localhost:50000',
        },
      },
    ]),
  ],
  controllers: [CrystallizationController],
  providers: [
    CrystallizationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
    SubscriptionGuard, // Optional global; use per-route
  ],
})
export class CrystallizationModule { }
