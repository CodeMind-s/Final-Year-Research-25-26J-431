import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PredictionsService } from './predictions.service';
import type {
    PredictionRequest,
    PredictionResponse,
    RetrainingRequest,
    RetrainingResponse,
} from './dtos/interfaces';

@Controller()
export class PredictionsController {
    private readonly logger = new Logger(PredictionsController.name);

    constructor(private readonly predictionsService: PredictionsService) {}

    @GrpcMethod('PredictionsService', 'GetPredictions')
    async getPredictions(request: PredictionRequest): Promise<PredictionResponse> {
        this.logger.log(
            `Received prediction request for ${request.forecast_days} days starting ${request.start_date}`,
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

    @GrpcMethod('PredictionsService', 'TriggerRetraining')
    async triggerRetraining(request: RetrainingRequest): Promise<RetrainingResponse> {
        this.logger.log(`Received retraining request — triggered_by: ${request.triggered_by}`);
        try {
            const response = await this.predictionsService.triggerRetraining(request);
            this.logger.log(`Retraining finished — success: ${response.success}`);
            return response;
        } catch (error) {
            this.logger.error(`Retraining failed: ${error}`);
            throw error;
        }
    }
}
