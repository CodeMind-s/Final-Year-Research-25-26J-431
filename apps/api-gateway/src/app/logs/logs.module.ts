import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LogsController } from './logs.controller';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'LOGS_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: 'logs',
          protoPath: join(__dirname, 'proto/logs.proto'),
          url: process.env.LOGS_SERVICE_URL || 'localhost:50056',
        },
      },
    ]),
  ],
  controllers: [LogsController],
})
export class LogsModule {}
