import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PredictionsModule } from './predictions/predictions.module';

@Module({
    imports: [
        MongooseModule.forRoot(
            process.env.MONGO_URI ||
            'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0',
        ),
        PredictionsModule,
    ],
})
export class AppModule {}
