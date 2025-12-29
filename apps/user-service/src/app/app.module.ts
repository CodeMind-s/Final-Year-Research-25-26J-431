import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';

const logger = new Logger('UserServiceModule');
const mongoUri = process.env.MONGO_URI || 
  'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0';

logger.log(`Connecting to MongoDB: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);

@Module({
  imports: [
    UserModule,
    MongooseModule.forRoot(mongoUri)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
