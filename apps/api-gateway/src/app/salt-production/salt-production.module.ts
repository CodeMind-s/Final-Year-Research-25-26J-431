import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { GrpcExceptionFilter } from '../../filters/grpc-exception.filter';
import { SaltProductionController } from './salt-production.controller';
import { getGrpcCredentials } from '../../grpc-credentials';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SALT_PRODUCTION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'saltproduction',
          protoPath: join(__dirname, 'proto/saltProduction.proto'),
          url: process.env.CRYSTALLIZATION_SERVICE_URL || 'localhost:50054',
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
    ]),
  ],
  controllers: [SaltProductionController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GrpcExceptionFilter,
    },
  ],
})
export class SaltProductionModule {}
