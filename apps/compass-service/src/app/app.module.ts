import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LandownerModule } from './landowner/landowner.module';
import { SellerModule } from './seller/seller.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoiceModule } from './invoice/invoice.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    LandownerModule,
    SellerModule,
    NotificationsModule,
    InvoiceModule,
    AnalyticsModule,
    SearchModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI || 
      'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0'
    ),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
