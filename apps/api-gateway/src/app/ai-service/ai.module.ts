import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { getGrpcCredentials } from '../../grpc-credentials';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'AI_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'ai',
          protoPath: join(__dirname, 'proto/ai.proto'),
          url: process.env.AI_SERVICE_URL || 'localhost:50059',
          credentials: getGrpcCredentials(),
        },
      },
    ]),
  ],
  controllers: [AiController],
})
export class AiModule {}
