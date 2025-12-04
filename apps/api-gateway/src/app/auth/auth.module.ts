import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { SubscriptionGuard } from './guards/subscription.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      global: true,
    }),
    ClientsModule.register([
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
  controllers: [AuthController],
  providers: [AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
    SubscriptionGuard
  ],
})
export class AuthModule {}
