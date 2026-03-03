import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { MlPredictorService } from './ml-predictor.service';
import { ProductionForecastService } from './production-forecast.service';
import { RetrainingService } from './retraining.service';
import { WeatherService } from './weather.service';
import {
    ActualMonthlyProduction,
    ActualMonthlyProductionSchema,
} from './schemas/actual-monthly-production.schema';
import {
    DailyMeasurement,
    DailyMeasurementSchema,
} from './schemas/daily-measurement.schema';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        MongooseModule.forFeature([
            {
                name: ActualMonthlyProduction.name,
                schema: ActualMonthlyProductionSchema,
            },
            {
                name: DailyMeasurement.name,
                schema: DailyMeasurementSchema,
            },
        ]),
        ClientsModule.register([
            {
                name: 'AUDIT_LOG_SERVICE',
                transport: Transport.KAFKA,
                options: {
                    client: {
                        clientId: 'crystallization-onnx-service',
                        brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
                    },
                    consumer: {
                        groupId: 'crystallization-onnx-audit-consumer-group',
                    },
                },
            },
        ]),
    ],
    controllers: [PredictionsController],
    providers: [
        PredictionsService,
        MlPredictorService,
        ProductionForecastService,
        RetrainingService,
        WeatherService,
    ],
})
export class PredictionsModule {}
