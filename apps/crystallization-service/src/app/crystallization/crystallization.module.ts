import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { CrystallizationController } from './crystallization.controller';
import { CrystallizationService } from './crystallization.service';
import { DailyMeasurement, DailyMeasurementSchema } from './schemas/crystallization.schema';
import { DailyParameterPrediction, DailyParameterPredictionSchema } from './schemas/daily-parameter-prediction.schema';
import { MonthlyProductionPrediction, MonthlyProductionPredictionSchema } from './schemas/monthly-production-prediction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyMeasurement.name, schema: DailyMeasurementSchema },
      { name: DailyParameterPrediction.name, schema: DailyParameterPredictionSchema },
      { name: MonthlyProductionPrediction.name, schema: MonthlyProductionPredictionSchema }
    ]),
    ClientsModule.register([
      {
        name: 'PREDICTIONS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'predictions',
          protoPath: join(__dirname, '../../../proto/crystallization-prediction.proto'),
          url: 'localhost:50055',
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
export class CrystallizationModule {}
