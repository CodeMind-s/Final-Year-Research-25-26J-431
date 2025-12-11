import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { LogsModule } from './logs/logs.module';
import { PredictionsModule } from './predictions/predictions.module';
import { CrystallizationModule } from './crystallization-service/crystallization.module';

@Module({
  imports: [
    AuthModule,
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
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'proto/user.proto'),
          url: 'localhost:50053',
        },
      },
    ]),
    UserModule,
    LogsModule,
    PredictionsModule,
    CrystallizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
