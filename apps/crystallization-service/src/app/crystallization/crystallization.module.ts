import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrystallizationController } from './crystallization.controller';
import { CrystallizationService } from './crystallization.service';
import { DailyMeasurement, DailyMeasurementSchema } from './schemas/crystallization.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: DailyMeasurement.name, schema: DailyMeasurementSchema }])],
  controllers: [CrystallizationController],
  providers: [CrystallizationService],
})
export class CrystallizationModule {}
