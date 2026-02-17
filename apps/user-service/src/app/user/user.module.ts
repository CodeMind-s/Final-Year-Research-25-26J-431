import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { LandOwnerDetails, LandOwnerDetailsSchema } from './schemas/land-owner-details.schema';
import { ServiceProviderDetails, ServiceProviderDetailsSchema } from './schemas/service-provider-details.schema';
import { LaboratoryDetails, LaboratoryDetailsSchema } from './schemas/laboratory-details.schema';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import * as fs from 'fs';
import * as path from 'path';

import * as LOD from './schemas/land-owner-details.schema';

console.log('DEBUG: UserModule loading...');
console.log('DEBUG: LOD exports keys:', Object.keys(LOD));
console.log('DEBUG: LandOwnerDetailsSchema value:', LOD.LandOwnerDetailsSchema);
try {
  const schemasDir = path.join(__dirname, 'schemas');
  if (fs.existsSync(schemasDir)) {
    console.log('DEBUG: Schemas dir exists:', schemasDir);
    console.log('DEBUG: Files in schemas:', fs.readdirSync(schemasDir));
  } else {
    console.log('DEBUG: Schemas dir NOT found:', schemasDir);
    console.log('DEBUG: Current dir:', __dirname);
    console.log('DEBUG: Files in current dir:', fs.readdirSync(__dirname));
  }
} catch (e) {
  console.error('DEBUG: Error checking files:', e);
}
console.log('DEBUG: LandOwnerDetailsSchema value:', LandOwnerDetailsSchema);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'LandOwnerDetails', schema: LandOwnerDetailsSchema },
      { name: 'ServiceProviderDetails', schema: ServiceProviderDetailsSchema },
      { name: 'LaboratoryDetails', schema: LaboratoryDetailsSchema },
    ]),
    ClientsModule.register([
      {
        name: 'AUDIT_LOG_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'user-service-audit',
            brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
          },
          consumer: {
            groupId: 'user-audit-consumer-group',
          },
        },
      },
    ]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule { }
