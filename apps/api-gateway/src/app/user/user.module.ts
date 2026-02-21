import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { APP_FILTER } from '@nestjs/core';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
      ClientsModule.register([
        {
          name: 'USER_PACKAGE',
          transport: Transport.GRPC,
          options: {
            package: 'user',
            protoPath: join(__dirname, 'proto/user.proto'),
            url: process.env.USER_SERVICE_URL || 'localhost:50053',
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
  controllers: [UserController],
  providers: [UserService,
        {
          provide: APP_FILTER,
          useClass: GrpcExceptionFilter,
        },
  ],
})
export class UserModule {}
