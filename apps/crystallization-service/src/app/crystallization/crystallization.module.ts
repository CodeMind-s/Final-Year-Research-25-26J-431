import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { CrystallizationController } from './crystallization.controller';
import { CrystallizationService } from './crystallization.service';
import { DailyMeasurement, DailyMeasurementSchema } from './schemas/crystallization.schema';
import { DailyParameterPrediction, DailyParameterPredictionSchema } from './schemas/daily-parameter-prediction.schema';
import { MonthlyProductionPrediction, MonthlyProductionPredictionSchema } from './schemas/monthly-production-prediction.schema';
import { CrystallizationModelPerformance, CrystallizationModelPerformanceSchema } from './schemas/crystallization-model-performance.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forFeature([
      { name: DailyMeasurement.name, schema: DailyMeasurementSchema },
      { name: DailyParameterPrediction.name, schema: DailyParameterPredictionSchema },
      { name: MonthlyProductionPrediction.name, schema: MonthlyProductionPredictionSchema },
      { name: CrystallizationModelPerformance.name, schema: CrystallizationModelPerformanceSchema }
    ]),
    ClientsModule.register([
      {
        name: 'PREDICTIONS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'predictions',
          protoPath: join(__dirname, 'proto/crystallization-prediction.proto'),
          url: process.env.ML_SERVICE_GRPC_URL || 'localhost:50055',
          loader: {
            keepCase: true,
          },
        },
      },
    ]),
  ],
  controllers: [CrystallizationController],
  providers: [CrystallizationService],
})
export class CrystallizationModule { }
