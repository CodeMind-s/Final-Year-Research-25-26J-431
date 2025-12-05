import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PredictionsController } from './predictions.controller';

@Module({
  imports: [
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
      {
        name: 'PREDICTIONS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'predictions',
          protoPath: join(__dirname, 'proto/predictions.proto'),
          url: 'localhost:50057',
        },
      },
    ]),
  ],
  controllers: [PredictionsController],
})
export class PredictionsModule {}
