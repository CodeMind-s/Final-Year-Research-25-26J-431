import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { MlPredictorService } from './ml-predictor.service';

@Module({
    controllers: [PredictionsController],
    providers: [PredictionsService, MlPredictorService],
})
export class PredictionsModule { }
