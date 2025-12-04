import { Module } from '@nestjs/common';
import {
  CrystallizationService,
} from './itineraries-plan.service';
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
        name: 'CRYSTALLIZATTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'Crystallization',
          protoPath: join(__dirname, 'proto/crystallization.proto'),
          url: 'localhost:50054', // Assume port for itineraries service
        },
      },
      {
        name: 'AUTH_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'auth',
          protoPath: join(__dirname, 'proto/auth.proto'), // Adjust if auth is in sibling dir (e.g., ../../ for Nx)
          url: 'localhost:50000', // Auth service port
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
export class CrystallizationModule {}
