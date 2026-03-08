import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'CRYSTALLIZATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'crystallization',
          protoPath: join(__dirname, 'proto/dailyMeasurements.proto'),
          url: process.env.CRYSTALLIZATION_SERVICE_URL || 'crystallization-service:50054',
        },
      },
    ]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
