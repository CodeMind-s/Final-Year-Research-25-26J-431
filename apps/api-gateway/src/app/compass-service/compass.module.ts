import { Module } from '@nestjs/common';
import { CompassService } from './compass.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { CompassController } from './compass.controller';
import { DistributorOfferController } from './distributor-offer.controller';
import { DealController } from './deal.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      global: true,
    }),
    ClientsModule.register([
      {
        name: 'COMPASS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'harvestplan',
          protoPath: join(__dirname, 'proto/harvestPlan.proto'),
          url: process.env.COMPASS_SERVICE_URL || 'localhost:50052',
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
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'proto/user.proto'),
          url: process.env.USER_SERVICE_URL || 'localhost:50053',
        },
      },
    ]),
  ],
  controllers: [CompassController, DistributorOfferController, DealController],
  providers: [
    CompassService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
    SubscriptionGuard,
  ],
})
export class CompassModule { }
