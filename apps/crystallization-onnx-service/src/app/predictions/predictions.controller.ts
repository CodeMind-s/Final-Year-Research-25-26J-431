import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PredictionsService } from './predictions.service';
import type { PredictionRequest, PredictionResponse } from './dtos/interfaces';

@Controller()
export class PredictionsController {
    private readonly logger = new Logger(PredictionsController.name);

    constructor(private readonly predictionsService: PredictionsService) { }

    @GrpcMethod('PredictionsService', 'GetPredictions')
    async getPredictions(request: PredictionRequest): Promise<PredictionResponse> {
        this.logger.log(
            `Received prediction request for ${request.forecast_days} days starting ${request.start_date}`
        );

        try {
            const response = await this.predictionsService.getPredictions(request);
            this.logger.log('Prediction completed successfully');
            return response;
        } catch (error) {
            this.logger.error(`Prediction failed: ${error}`);
            throw error;
        }
    }
}
