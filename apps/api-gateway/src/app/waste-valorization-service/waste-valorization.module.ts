import { Module } from '@nestjs/common';
import { WasteValorizationService } from './waste-valorization.service';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { WasteValorizationController, WasteManagementDashboardController } from './waste-valorization.controller';
import { getGrpcCredentials } from '../../grpc-credentials';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      global: true,
    }),
    ClientsModule.register([
      {
        name: 'WASTE_VALORIZATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'wasteval',
          protoPath: join(__dirname, 'proto/wasteValorization.proto'),
          url: process.env.WASTE_VALORIZATION_SERVICE_URL || 'localhost:50058',
          credentials: getGrpcCredentials(),
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
  controllers: [WasteValorizationController, WasteManagementDashboardController],
  providers: [
    WasteValorizationService,
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
export class WasteValorizationModule {}
