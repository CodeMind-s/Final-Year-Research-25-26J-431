import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogsModule } from './logs/logs.module';

@Module({
  imports: [
    LogsModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI || 
      'mongodb+srv://backend:qOcyo4PRHs9qGuy0@cluster0.19todyv.mongodb.net/travel-app-logs?retryWrites=true&w=majority'
    ),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
