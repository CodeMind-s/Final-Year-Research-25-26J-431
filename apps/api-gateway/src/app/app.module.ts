import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { AuditLogModule } from './audit-logs/audit-log.module';
import { AuditLogInterceptor } from './audit-logs/audit-log.interceptor';
import { CrystallizationModule } from './crystallization-service/crystallization.module';
import { SaltProductionModule } from './salt-production/salt-production.module';
import { CompassModule } from './compass-service/compass.module';
import { VisionModule } from './vision-service/vision.module';

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
          url: process.env.AUTH_SERVICE_URL || 'localhost:50000',
        },
      },
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'proto/user.proto'),
          url: process.env.USER_SERVICE_URL || 'localhost:50053',
        },
      },
    ]),
    UserModule,
    AuditLogModule,
    CrystallizationModule,
    SaltProductionModule,
    CompassModule,
    VisionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}

