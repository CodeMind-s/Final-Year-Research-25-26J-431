import { Module } from '@nestjs/common';
import { CompassService } from './compass.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { LandownerController } from './landowner.controller';
import { SellerController } from './seller.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      global: true,
    }),
    ClientsModule.register([
      {
        name: 'COMPASS_LANDOWNER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'landowner',
          protoPath: join(__dirname, 'proto/compass-landowner.proto'),
          url: 'localhost:50056',
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
        name: 'COMPASS_SELLER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'seller',
          protoPath: join(__dirname, 'proto/compass-seller.proto'),
          url: 'localhost:50056',
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
          url: 'localhost:50000',
        },
      },
    ]),
  ],
  controllers: [
    LandownerController,
    SellerController,
  ],
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
export class CompassModule {}
