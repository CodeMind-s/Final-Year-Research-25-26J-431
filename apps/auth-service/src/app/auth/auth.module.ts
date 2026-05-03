import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { LandOwnerDetails, LandOwnerDetailsSchema } from './schemas/land-owner-details.schema';
import { ServiceProviderDetails, ServiceProviderDetailsSchema } from './schemas/service-provider-details.schema';
import { LaboratoryDetails, LaboratoryDetailsSchema } from './schemas/laboratory-details.schema';

import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { getKafkaClientConfig } from '@brinex-server/kafka-config';
import { SubscriptionModule } from './subscription/subscription.module';
import { getJwtModuleOptions } from './jwt-config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LandOwnerDetails.name, schema: LandOwnerDetailsSchema },
      { name: ServiceProviderDetails.name, schema: ServiceProviderDetailsSchema },
      { name: LaboratoryDetails.name, schema: LaboratoryDetailsSchema },
    ]),
    PassportModule,
    JwtModule.register(getJwtModuleOptions()),
    ClientsModule.register([
      {
        name: 'EMAIL_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: getKafkaClientConfig('auth-service-email'),
          consumer: {
            groupId: 'auth-email-consumer-group',
          },
        },
      },
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: getKafkaClientConfig('auth-service-audit'),
          consumer: {
            groupId: 'auth-audit-consumer-group',
          },
        },
      },
    ]),
    SubscriptionModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
