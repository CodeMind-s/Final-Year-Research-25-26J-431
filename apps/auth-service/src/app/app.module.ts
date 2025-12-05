import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI || 
      'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/?appName=Cluster0'
    )
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
}
