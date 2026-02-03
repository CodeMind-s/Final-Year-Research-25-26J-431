import { Module } from '@nestjs/common';
import { PredictionsModule } from './predictions/predictions.module';

@Module({
    imports: [PredictionsModule],
})
export class AppModule { }
