import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { NotificationModule } from './notification/notification.module';
import {} from '@nestjs/common';
import { RecommendationModule } from './recommendation/recommendation.module';
import { UserModule } from './user/user.module';
import { ItinerariesPlanModule } from './itinerarie-plan/itineraries-plan.module';
import { CommunityServiceModule } from './community-service/community-service.module';
import { TipsServiceModule } from './tips-service/tips-service.module';
import { ToolsServiceService } from './tools-service/tools-service.service';
import { ToolsServiceModule } from './tools-service/tools-service.module';
import { LogsServiceModule } from './logs-service/logs-service.module';
import { LogsModule } from './logs/logs.module';

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
        name: 'NOTIFICATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'notification',
          protoPath: join(__dirname, 'proto/notification.proto'),
          url: 'localhost:50051',
        },
      },
      {
        name: 'RECOMMENDATION_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'recommendation',
          protoPath: join(__dirname, 'proto/recommendation.proto'),
          url: 'localhost:50052', // Matches recommendation service port
        },
      },
      {
        name: 'USER_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'user',
          protoPath: join(__dirname, 'proto/user.proto'),
          url: 'localhost:50053', // Matches recommendation service port
        },
      },
      {
        name: 'ITINERARIES_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'itineraries',
          protoPath: join(__dirname, 'proto/itineraries.proto'),
          url: 'localhost:50054', // Assume port for itineraries service
        },
      },
      {
        name: 'COMMUNITY_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'community',
          protoPath: join(__dirname, 'proto/community.proto'),
          url: 'localhost:50055', // Assume port for itineraries service
        },
      },
      {
        name: 'TIPS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'tips',
          protoPath: join(__dirname, 'proto/tips.proto'),
          url: 'localhost:50056', // Assume port for itineraries service
        },
      },
      {
        name: 'TOOLS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'tools',
          protoPath: join(__dirname, 'proto/tool.proto'),
          url: 'localhost:50057', // Assume port for itineraries service
        },
      },
      // {
      //   name: 'TRIP_PACKAGE',
      //   transport: Transport.GRPC,
      //   options: {
      //     package: 'trip',
      //     protoPath: join(__dirname, 'proto/trip.proto'),
      //     url: 'trip-service:50052',
      //   },
      // },
      // {
      //   name: 'KAFKA_SERVICE',
      //   transport: Transport.KAFKA,
      //   options: {
      //     client: { brokers: ['kafka:9092'] },
      //   },
      // },
    ]),
    UserModule,
    RecommendationModule,
    NotificationModule,
    ItinerariesPlanModule,
    CommunityServiceModule,
    TipsServiceModule,
    ToolsServiceModule,
    LogsServiceModule,
    LogsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ToolsServiceService],
})
export class AppModule {}
